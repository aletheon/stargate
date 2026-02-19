import { WebSocket } from 'ws';
import { execSync } from 'child_process';

const WS_URL = 'ws://localhost:8080';
const DEVICE_ID = 'test-drone-001';

async function verify() {
    console.log('--- Starting Stargate Phase 1 Verification ---');

    // 1. Start Event Bus in background (simulated by spawning process if needed, but here we assume it's running)
    // For this test, we'll try to connect. If it fails, we'll tell the user to start the bus.

    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('[CLIENT] Connected to Event Bus');
        // Send connect handshake
        ws.send(JSON.stringify({
            type: 'connect',
            role: 'drone',
            deviceId: DEVICE_ID,
            protocolVersion: 'v9.7'
        }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log('[CLIENT] Received:', msg);

        if (msg.type === 'pairing-required') {
            const code = msg.pairingCode;
            console.log(`[TEST] Received pairing code: ${code}`);

            // 2. Approve via CLI
            console.log(`[TEST] Approving device via CLI: pfsd pairing approve drone ${code}`);
            try {
                execSync(`node dist/cli/index.js pairing approve drone ${code}`);
                console.log('[TEST] CLI Approval successful');

                // 3. Re-connect or send connect again
                console.log('[CLIENT] Sending second connect handshake...');
                ws.send(JSON.stringify({
                    type: 'connect',
                    role: 'drone',
                    deviceId: DEVICE_ID,
                    protocolVersion: 'v9.7'
                }));
            } catch (err) {
                console.error('[TEST] CLI Approval failed:', err);
                process.exit(1);
            }
        }

        if (msg.type === 'hello-ok') {
            console.log('[TEST] Connection authorized!');
            // 4. Test Health Request
            console.log('[CLIENT] Sending health request...');
            ws.send(JSON.stringify({ type: 'health' }));
        }

        if (msg.type === 'hello-ok' && msg.health === 'OK') {
            console.log('[SUCCESS] Health check passed!');
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (err) => {
        console.error('[CLIENT] WebSocket Error. Is the server running? npm run bus');
        process.exit(1);
    });
}

verify();
