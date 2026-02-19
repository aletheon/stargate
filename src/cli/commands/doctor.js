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
    }
    catch (err) {
        logger.error('Configuration invalid or missing.');
    }
    // 2. MLX/Metal Smoke Test
    try {
        const pythonCheck = "import mlx.core as mx; print(mx.default_device())";
        const result = execSync(`python3 -c "${pythonCheck}"`, { encoding: 'utf-8' }).trim();
        if (result.includes('Device(gpu, 0)')) {
            logger.success(`Metal GPU Verified: ${result}`);
        }
        else {
            logger.warn(`Metal GPU not set as default: ${result}`);
        }
    }
    catch (err) {
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
        clearTimeout(timeout);
        const latency = performance.now() - start;
        if (latency < 5) {
            logger.success(`Local Latency: ${latency.toFixed(2)}ms (Optimal)`);
        }
        else {
            logger.warn(`Local Latency: ${latency.toFixed(2)}ms (Target < 5ms not met)`);
        }
        ws.close();
    });
    ws.on('error', () => {
        clearTimeout(timeout);
        logger.error('Failed to connect to Local Event Bus. Start the server first.');
    });
}
//# sourceMappingURL=doctor.js.map