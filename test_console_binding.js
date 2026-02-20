import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('[DRONE] Connected to Event Bus');
    ws.send(JSON.stringify({
        type: 'connect',
        role: 'drone',
        deviceId: 'drone-test',
        protocolVersion: 'v9.7'
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'hello-ok') {
        process.stdout.write('[DRONE] Authorized. Simulation Live (Dynamic Speed).\n');

        let angle = 0;
        setInterval(() => {
            angle += 0.05;
            // Pulsing speed to make the magnitude obviously dynamic
            const speedFactor = 2.0 + Math.sin(angle * 0.2) * 1.5;

            // Position (0, 1, 2)
            const x = Math.cos(angle) * 5;
            const y = Math.sin(angle) * 5;
            const z = 2.0 + Math.sin(angle * 0.3) * 1.0;

            // Velocity (3, 4, 5) - High Variance
            const vx = -Math.sin(angle) * speedFactor;
            const vy = Math.cos(angle) * speedFactor;
            const vz = Math.cos(angle * 0.3) * 0.5;

            // Rotation (6, 7, 8, 9) - Simulating tilt based on velocity
            const qx = 0;
            const qy = 0;
            const qz = Math.sin(angle * 0.5);
            const qw = Math.cos(angle * 0.5);

            // Angular Vel (10, 11, 12)
            const ax = 0, ay = 0, az = 0.1;

            // Send Observation
            ws.send(JSON.stringify({
                type: 'observation',
                values: [x, y, z, vx, vy, vz, qx, qy, qz, qw, ax, ay, az]
            }));

            // High velocity bursts to trigger VETO
            if (Math.random() < 0.03) {
                const burstId = 'veto-' + Date.now();
                console.log(`[DRONE] Proposing burst: ${burstId}`);
                ws.send(JSON.stringify({
                    type: 'intent.propose',
                    id: burstId,
                    action: 'velocity',
                    value: [8, 2, 0] // Exceeds 5.0 limit
                }));
            }
        }, 50); // 20Hz
    }
});
