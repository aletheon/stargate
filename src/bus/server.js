import { WebSocketServer, WebSocket } from 'ws';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { PfsdMessage, ConnectionHandshake } from './schemas.js';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig, generatePairingCode } from '../utils/config.js';
import * as http from 'http';
const messageCompiler = TypeCompiler.Compile(PfsdMessage);
const connectCompiler = TypeCompiler.Compile(ConnectionHandshake);
class EventBus {
    wss = null;
    sessions = new Map();
    idempotencyCache = new Map();
    IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes
    constructor() {
        this.startCleanupTask();
    }
    start() {
        const config = loadConfig();
        const port = 8080;
        const host = (config.tailscale.mode === 'serve' || config.tailscale.mode === 'funnel')
            ? '127.0.0.1'
            : '0.0.0.0';
        logger.info(`Starting PFSD Event Bus on ${host}:${port}...`);
        const server = http.createServer();
        this.wss = new WebSocketServer({ server });
        this.wss.on('connection', (ws) => {
            this.sessions.set(ws, { ws, paired: false });
            logger.bus('New connection established');
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
    handleMessage(ws, rawData) {
        let msg;
        try {
            msg = JSON.parse(rawData);
        }
        catch (e) {
            return this.sendError(ws, 'Invalid JSON');
        }
        if (!messageCompiler.Check(msg)) {
            return this.sendError(ws, 'Schema validation failed');
        }
        const session = this.sessions.get(ws);
        if (!session)
            return;
        // Idempotency check
        const msgWithIdempotency = msg;
        if (msgWithIdempotency.idempotencyKey) {
            if (this.idempotencyCache.has(msgWithIdempotency.idempotencyKey)) {
                logger.warn(`Duplicate request detected: ${msgWithIdempotency.idempotencyKey}`);
                return;
            }
            this.idempotencyCache.set(msgWithIdempotency.idempotencyKey, Date.now());
        }
        // Role-based filtering and State Machine
        if (!session.paired) {
            if (msg.type === 'connect') {
                this.handleConnect(session, msg);
            }
            else if (msg.type === 'health') {
                this.send(ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
            }
            else {
                this.send(ws, { type: 'pairing-required', pairingCode: 'Handshake required' });
            }
            return;
        }
        // Paired session logic
        if (msg.type === 'policy.update') {
            if (session.role !== 'console') {
                return this.sendError(ws, 'Unauthorized: Only console can update policy');
            }
            logger.bus('Policy update received');
            // Process policy update...
        }
        // Handle other messages...
        logger.bus(`Received message: ${msg.type} from ${session.deviceId}`);
        if (msg.type === 'health') {
            this.send(ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
        }
    }
    handleConnect(session, msg) {
        const config = loadConfig();
        const device = config.pairedDevices.find(d => d.deviceId === msg.deviceId);
        if (device && device.approved) {
            session.paired = true;
            session.deviceId = msg.deviceId;
            session.role = msg.role;
            logger.success(`Device ${msg.deviceId} (${msg.role}) authorized`);
            this.send(session.ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
        }
        else if (device && !device.approved) {
            // Device exists but is not approved, approve it now
            device.approved = true;
            device.role = msg.role; // Cast to any to allow assignment if typebox schema is strict
            delete device.pairingCode; // Remove pairing code once approved
            saveConfig(config);
            session.paired = true;
            session.deviceId = msg.deviceId;
            session.role = msg.role;
            logger.success(`Device ${msg.deviceId} (${msg.role}) approved and authorized`);
            this.send(session.ws, { type: 'hello-ok', health: 'OK', policyVersion: 'v9.7' });
        }
        else {
            const code = generatePairingCode();
            // No existing device, create a new one
            config.pairedDevices.push({
                deviceId: msg.deviceId,
                token: '', // Phase 2
                role: msg.role,
                approved: false,
                pairingCode: code
            });
            saveConfig(config);
            logger.warn(`Device ${msg.deviceId} requires pairing. Code: ${code}`);
            this.send(session.ws, { type: 'pairing-required', pairingCode: code });
        }
    }
    send(ws, msg) {
        ws.send(JSON.stringify(msg));
    }
    sendError(ws, message) {
        logger.error(message);
        ws.send(JSON.stringify({ type: 'error', message }));
    }
    startCleanupTask() {
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
//# sourceMappingURL=server.js.map