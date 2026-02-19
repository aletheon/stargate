import { WebSocketServer, WebSocket } from 'ws';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import type { Static } from '@sinclair/typebox';
import { PfsdMessage, ConnectionHandshake } from './schemas.js';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig, generatePairingCode } from '../utils/config.js';
import * as http from 'http';

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

    constructor() {
        this.startCleanupTask();
    }

    public start() {
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
            // Process policy update...
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
