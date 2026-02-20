import { WebSocketServer, WebSocket } from 'ws';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import type { Static } from '@sinclair/typebox';
import { PfsdMessage, ConnectionHandshake } from './schemas.js';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig, generatePairingCode } from '../utils/config.js';
import * as http from 'http';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const SA_FILE = 'eleutherios-mvp-sa.json';

const messageCompiler = TypeCompiler.Compile(PfsdMessage);
const connectCompiler = TypeCompiler.Compile(ConnectionHandshake);

interface Session {
    ws: WebSocket;
    deviceId?: string;
    role?: string;
    paired: boolean;
}

class EventBus {
    private wss: WebSocketServer | null = null;
    private sessions = new Map<WebSocket, Session>();
    private idempotencyCache = new Map<string, number>();
    private readonly IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes
    private db: Firestore | null = null;

    constructor() {
        this.startCleanupTask();
    }

    public start() {
        this.initFirebase();
        const config = loadConfig();
        const port = 8080;
        const host = (config.tailscale?.mode === 'serve' || config.tailscale?.mode === 'funnel')
            ? '127.0.0.1'
            : '0.0.0.0';

        logger.info(`Starting PFSD Event Bus on ${host}:${port}...`);

        const server = http.createServer();
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            this.sessions.set(ws, { ws, paired: false });
            setImmediate(() => logger.bus('New connection established'));

            ws.on('message', (data) => this.handleMessage(ws, data.toString()));
            ws.on('close', () => {
                this.sessions.delete(ws);
                logger.bus('Connection closed');
            });
        });

        server.listen(port, host, () => {
            logger.success(`Event Bus listening on ${host}:${port}`);
        });

        server.on('error', (err) => {
            logger.error(`Server error: ${err.message}`);
            process.exit(1);
        });
    }

    private handleMessage(ws: WebSocket, rawData: string) {
        let rawMsg: any;
        try {
            rawMsg = JSON.parse(rawData);
        } catch (e) {
            return this.sendError(ws, 'Invalid JSON');
        }

        // --- HIGH-PERFORMANCE FAST-PATH ---
        // Bypass full schema validation for common, low-risk messages
        if (rawMsg && typeof rawMsg === 'object') {
            if (rawMsg.type === 'health') {
                return this.send(ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
            }
            if (rawMsg.type === 'connect') {
                if (connectCompiler.Check(rawMsg)) {
                    const session = this.sessions.get(ws);
                    if (session) {
                        this.handleConnect(session, rawMsg as Static<typeof ConnectionHandshake>);
                        return;
                    }
                }
            }
        }

        // Full validation for all other messages
        if (!messageCompiler.Check(rawMsg)) {
            return this.sendError(ws, 'Schema validation failed');
        }

        const msg = rawMsg as PfsdMessage;
        const session = this.sessions.get(ws);
        if (!session) return;

        // Idempotency check (optimized)
        if ('idempotencyKey' in msg && typeof msg.idempotencyKey === 'string') {
            const key = msg.idempotencyKey;
            if (this.idempotencyCache.has(key)) {
                setImmediate(() => logger.warn(`Duplicate request detected: ${key}`));
                return;
            }
            this.idempotencyCache.set(key, Date.now());
        }

        if (msg.type === 'bus.status') {
            const status = Array.from(this.sessions.values()).map(s => ({
                deviceId: s.deviceId,
                role: s.role,
                paired: s.paired
            }));
            this.send(ws, { type: 'bus.status-ok', sessions: status });
            return;
        }

        // Role-based filtering and State Machine
        if (!session.paired) {
            if (msg.type === 'pairing-required' || msg.type === 'hello-ok') {
                // Ignore self-emitted or invalid state messages
                return;
            }
            this.send(ws, { type: 'pairing-required', pairingCode: 'Handshake required' });
            return;
        }

        // Paired session logic
        if (msg.type === 'policy.update') {
            if (session.role !== 'console') {
                return this.sendError(ws, 'Unauthorized: Only console can update policy');
            }
            setImmediate(() => logger.bus('Policy update received'));

            // 1. Persist to Firestore as the root flight axiom
            const policyId = 'root_flight_axioms';
            const collectionPath = 'artifacts/stargate/public/data/policy_registry';

            if (!this.db) {
                this.sendError(ws, 'Firestore not initialized');
                return;
            }

            this.db.collection(collectionPath).doc(policyId).set({
                constraints: msg.constraints,
                last_updated: FieldValue.serverTimestamp(),
                updated_by: session.deviceId
            }, { merge: true }).then(() => {
                logger.success('Policy registry updated in Firestore');
                // 2. Broadcast policy.reloaded to all bridge sessions immediately after successful write
                let broadcastCount = 0;
                for (const s of this.sessions.values()) {
                    if (s.role === 'bridge' && s.paired) {
                        this.send(s.ws, { type: 'policy.reloaded' });
                        broadcastCount++;
                    }
                }
                logger.bus(`Policy reloaded signal broadcasted to ${broadcastCount} bridges`);
            }).catch(err => {
                logger.error(`Failed to update policy registry: ${err}`);
                this.sendError(ws, 'Internal Server Error: Policy persistence failed');
            });
            return;
        }

        if (msg.type === 'intent.propose') {
            for (const s of this.sessions.values()) {
                if (s.role === 'bridge' && s.paired) {
                    this.send(s.ws, msg);
                }
            }
        }

        if (msg.type === 'intent.decision' || msg.type === 'governance.warning') {
            // Forward decisions and warnings to both drones and consoles
            for (const s of this.sessions.values()) {
                if ((s.role === 'drone' || s.role === 'console') && s.paired) {
                    this.send(s.ws, msg);
                }
            }
        }

        if (msg.type === 'observation') {
            // Forward raw telemetry to consoles for 3D visualization
            for (const s of this.sessions.values()) {
                if (s.role === 'console' && s.paired) {
                    this.send(s.ws, msg);
                }
            }
        }

        if (msg.type === 'pic.append') {
            // Forward auditable records to consoles
            for (const s of this.sessions.values()) {
                if (s.role === 'console' && s.paired) {
                    this.send(s.ws, msg);
                }
            }
            this.persistToFirestore('artifacts/stargate/public/data/pic_chain', msg.record);
        }

        if (msg.type === 'governance.warning') {
            this.persistToFirestore('artifacts/stargate/public/data/warnings', {
                message: msg.message,
                deviceId: session.deviceId,
                role: session.role
            });
        }

        // Handle other messages...
        setImmediate(() => logger.bus(`Received message: ${msg.type} from ${session.deviceId}`));
    }

    private handleConnect(session: Session, msg: Static<typeof ConnectionHandshake>) {
        const config = loadConfig();
        const device = config.pairedDevices.find(d => d.deviceId === msg.deviceId);

        if (device && device.approved) {
            session.paired = true;
            session.deviceId = msg.deviceId;
            session.role = msg.role;
            logger.success(`Device ${msg.deviceId} (${msg.role}) authorized`);
            this.send(session.ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
        } else if (device && !device.approved) {
            // Device exists but is not approved, approve it now
            device.approved = true;
            device.role = msg.role as any; // Cast to any to allow assignment if typebox schema is strict
            delete device.pairingCode; // Remove pairing code once approved
            saveConfig(config);
            session.paired = true;
            session.deviceId = msg.deviceId;
            session.role = msg.role;
            logger.success(`Device ${msg.deviceId} (${msg.role}) approved and authorized`);
            this.send(session.ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
        } else {
            const code = generatePairingCode();
            // No existing device, create a new one
            config.pairedDevices.push({
                deviceId: String(msg.deviceId),
                token: '', // Phase 2
                role: msg.role as any,
                approved: false,
                pairingCode: code
            });
            saveConfig(config);
            logger.warn(`Device ${msg.deviceId} requires pairing. Code: ${code}`);
            this.send(session.ws, { type: 'pairing-required', pairingCode: code });
        }
    }

    private send(ws: WebSocket, msg: any) {
        ws.send(JSON.stringify(msg));
    }

    private sendError(ws: WebSocket, message: string) {
        setImmediate(() => logger.error(message));
        ws.send(JSON.stringify({ type: 'error', message }));
    }
    private initFirebase() {
        if (fs.existsSync(SA_FILE)) {
            try {
                const serviceAccount = JSON.parse(fs.readFileSync(SA_FILE, 'utf-8'));
                if (getApps().length === 0) {
                    initializeApp({
                        credential: cert(serviceAccount)
                    });
                }
                this.db = getFirestore();
                logger.success('Firebase Admin SDK initialized in Event Bus');
            } catch (err) {
                logger.error(`Failed to initialize Firebase: ${err}`);
            }
        } else {
            logger.warn(`${SA_FILE} missing. Persistence disabled.`);
        }
    }

    private async updateFirestoreDocument(collectionPath: string, docId: string, data: any) {
        if (!this.db) return;
        const docRef = this.db.collection(collectionPath).doc(docId);
        await docRef.set(data, { merge: true });
    }

    private async persistToFirestore(collectionPath: string, data: any) {
        if (!this.db) return;
        const maxRetries = 5;
        const backoff = [1000, 2000, 4000, 8000, 16000];
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const docData = {
                    ...data,
                    bus_timestamp: FieldValue.serverTimestamp()
                };
                await this.db.collection(collectionPath).add(docData);
                return;
            } catch (err) {
                attempt++;
                if (attempt === maxRetries) {
                    logger.error(`Firestore write to ${collectionPath} failed after ${maxRetries} attempts: ${err}`);
                    return;
                }
                const delay = backoff[attempt - 1];
                logger.warn(`Firestore write attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    private startCleanupTask() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, timestamp] of this.idempotencyCache.entries()) {
                if (now - timestamp > this.IDEMPOTENCY_TTL) {
                    this.idempotencyCache.delete(key);
                }
            }
        }, 60000); // Clean every minute
    }
}

const bus = new EventBus();
bus.start();
