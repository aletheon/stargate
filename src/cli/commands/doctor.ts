import { execSync } from 'child_process';
import { WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { loadConfig } from '../../utils/config.js';

export async function doctor() {
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
