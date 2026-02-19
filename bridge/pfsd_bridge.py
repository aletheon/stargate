import asyncio
import json
import websockets
import mlx.core as mx
import numpy as np
import time
from datetime import datetime

class PfsdBridge:
    def __init__(self, uri="ws://localhost:8080"):
        self.uri = uri
        self.role = "bridge"
        self.device_id = "bridge-001"
        # MLX-backed rolling buffer for observations (pos, vel, rot, angvel = 13 floats)
        self.buffer_size = 1000
        self.obs_buffer = mx.zeros((self.buffer_size, 13))
        self.buffer_ptr = 0
        self.running = True

    async def connect(self):
        print(f"[BRIDGE] Connecting to Event Bus at {self.uri}...")
        try:
            async with websockets.connect(self.uri) as websocket:
                # 1. Handshake
                handshake = {
                    "type": "connect",
                    "role": self.role,
                    "deviceId": self.device_id,
                    "protocolVersion": "v9.7"
                }
                await websocket.send(json.dumps(handshake))
                
                # 2. Event Loop
                while self.running:
                    message = await websocket.recv()
                    data = json.loads(message)
                    
                    if data.get("type") == "hello-ok":
                        print("[BRIDGE] Authorized by Event Bus.")
                    
                    elif data.get("type") == "semantic.context":
                        print(f"[BRIDGE] Semantic Context Update: {len(data['tags'])} objects detected.")
                        # Audit log placeholder
                    
                    elif data.get("type") == "intent.propose":
                        await self.handle_intent(websocket, data)

                    elif data.get("type") == "observation":
                        self.log_observation(data["values"])

        except Exception as e:
            print(f"[BRIDGE] Error: {e}")

    async def handle_intent(self, websocket, intent):
        # Mock Policy: Truncate if target_velocity > 5.0m/s
        target_vel = intent.get("target_velocity", 0)
        
        if target_vel > 5.0:
            print(f"[GOVERNANCE] VETO/TRUNCATION: Target velocity {target_vel} exceeds 5.0m/s limit.")
            # Emit Warning
            warning = {
                "type": "governance.warning",
                "message": f"Velocity limit exceeded: {target_vel}m/s",
                "id": intent.get("id")
            }
            await websocket.send(json.dumps(warning))
            
            # Send Decision
            decision = {
                "type": "intent.decision",
                "id": intent.get("id"),
                "decision": "TRUNCATION"
            }
            await websocket.send(json.dumps(decision))
        else:
            # Clear Intent
            decision = {
                "type": "intent.decision",
                "id": intent.get("id"),
                "decision": "CLEARANCE"
            }
            await websocket.send(json.dumps(decision))

    def log_observation(self, values):
        # Convert to MLX and store in rolling buffer
        obs = mx.array(values)
        # In a real scenario, we'd slice/index this properly. 
        # For the mock, we just update the pointer.
        # self.obs_buffer[self.buffer_ptr] = obs 
        self.buffer_ptr = (self.buffer_ptr + 1) % self.buffer_size
        if self.buffer_ptr % 100 == 0:
            print(f"[BRIDGE] Observations logged: {self.buffer_ptr}/{self.buffer_size}")

if __name__ == "__main__":
    bridge = PfsdBridge()
    try:
        asyncio.run(bridge.connect())
    except KeyboardInterrupt:
        print("[BRIDGE] Shutting down.")
