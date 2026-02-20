import { execSync } from 'child_process';
import { WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { loadConfig } from '../../utils/config.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as crypto from 'crypto';

const SA_FILE = 'eleutherios-mvp-sa.json';

export async function doctor(options: { verifyPic?: boolean }) {
    if (options.verifyPic) {
        return await verifyPicChain();
    }
    logger.cli('Running Stargate Diagnostics (pfsd doctor)...');

    // 1. Config Validity
    try {
        const config = loadConfig();
        logger.success('Configuration valid.');
    } catch (err) {
        logger.error('Configuration invalid or missing.');
    }

    // 2. MLX/Metal Smoke Test
    try {
        const pythonCheck = "import mlx.core as mx; print(mx.default_device())";
        const result = execSync(`python3 -c "${pythonCheck}"`, { encoding: 'utf-8' }).trim();
        if (result.includes('Device(gpu, 0)')) {
            logger.success(`Metal GPU Verified: ${result}`);
        } else {
            logger.warn(`Metal GPU not set as default: ${result}`);
        }
    } catch (err) {
        logger.error('MLX/Metal check failed. Ensure mlx is installed in python3 path.');
    }

    // 3. WS Latency Benchmark
    logger.cli('Benchmarking local WebSocket latency (Target < 5ms)...');
    const start = performance.now();
    const ws = new WebSocket('ws://localhost:8080');

    const timeout = setTimeout(() => {
        ws.terminate();
        logger.error('WebSocket connection timed out. Is the Event Bus running?');
    }, 2000);

    ws.on('open', () => {
        const pingStart = performance.now();
        ws.send(JSON.stringify({ type: 'health' }));

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'hello-ok') {
                const latency = performance.now() - pingStart;
                if (latency < 5) {
                    logger.success(`Fast-Path RTT Latency: ${latency.toFixed(2)}ms (Optimal)`);
                } else {
                    logger.warn(`Fast-Path RTT Latency: ${latency.toFixed(2)}ms (Target < 5ms not met)`);
                }

                // --- PHASE 2: Bridge Status Check ---
                ws.send(JSON.stringify({ type: 'bus.status' }));
            }

            if (msg.type === 'bus.status-ok') {
                clearTimeout(timeout);
                const bridges = msg.sessions.filter((s: any) => s.role === 'bridge');
                if (bridges.length > 0) {
                    logger.success(`Unity Bridge Verified: ${bridges.length} active link(s).`);
                } else {
                    logger.warn('No active Unity Bridge detected. Ensure pfsd_bridge.py is running.');
                }

                console.log('\n' + '='.repeat(40));
                console.log('       ✨ STARGATE ACTIVE ✨');
                console.log('='.repeat(40) + '\n');

                ws.close();
            }
        });
    });

    ws.on('error', () => {
        clearTimeout(timeout);
        logger.error('Failed to connect to Local Event Bus. Start the server first.');
    });
}

async function verifyPicChain() {
    logger.cli('Verifying Merkle PIC Chain integrity (Last 50 entries)...');

    if (!fs.existsSync(SA_FILE)) {
        logger.error(`${SA_FILE} not found. Cannot verify Firestore.`);
        return;
    }

    try {
        const serviceAccount = JSON.parse(fs.readFileSync(SA_FILE, 'utf-8'));
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(serviceAccount)
            });
        }
        const db = getFirestore();
        const chainRef = db.collection('artifacts/stargate/public/data/pic_chain');
        const snapshot = await chainRef.orderBy('timestamp', 'desc').limit(50).get();

        if (snapshot.empty) {
            logger.warn('PIC Chain is empty. Nothing to verify.');
            return;
        }

        const docs = snapshot.docs.map(d => d.data()).filter((d: any) => !!d);
        let verifiedCount = 0;

        // Iterate backwards through the fetched list (oldest to newest among the 50)
        for (let i = docs.length - 1; i >= 0; i--) {
            const current = docs[i];
            if (!current) continue;

            const dataToHash = { ...current };
            delete dataToHash.hash;
            delete dataToHash.bus_timestamp; // Exclude bus-added field

            // Recompute hash: sha256(json_string(data) + prev_hash)
            // Note: Use a more stable JSON stringify for cross-language matching (no spaces)
            const dataStr = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
            const computedHash = crypto.createHash('sha256').update(dataStr + current.prev_hash).digest('hex');

            if (computedHash !== current.hash) {
                logger.error(`Merkle Violation detected at hash: ${current.hash}`);
                logger.error(`Computed: ${computedHash}`);
                logger.error(`Data String used: ${dataStr}`);
                logger.error(`Timestamp: ${current.timestamp}`);
            } else {
                verifiedCount++;
            }
        }

        if (verifiedCount === docs.length) {
            logger.success(`Merkle Chain Verified: All ${verifiedCount} entries validated successfully.`);
        } else {
            logger.warn(`Verification Complete: ${verifiedCount} successes, ${docs.length - verifiedCount} failures.`);
        }
    } catch (err) {
        logger.error(`Verification failed: ${err}`);
    }
}
