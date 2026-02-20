import asyncio
import json
import websockets
import mlx.core as mx
import numpy as np
import time
import math
from datetime import datetime
from pip import PIP
from pfsd_kernel import PFSDKernel

class PfsdBridge:
    def __init__(self, uri="ws://localhost:8080"):
        self.uri = uri
        self.role = "bridge"
        self.device_id = "bridge-001"
        
        # Phase 3: Governance Core
        self.pip = PIP()
        try:
            self.constraints = self.pip.get_effective_constraints()
        except Exception:
            # Fallback if Firestore is empty or unreachable during init
            self.constraints = {"MAX_VELOCITY": {"limit": 5.0, "warning_threshold": 4.0}}
        
        self.kernel = PFSDKernel(self.constraints)
        
        # MLX-backed rolling buffer for observations
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
                
                # 2. Start Simulation Loop
                sim_task = asyncio.create_task(self.simulate_flight(websocket))
                
                # 3. Event Loop
                while self.running:
                    message = await websocket.recv()
                    data = json.loads(message)
                    
                    if data.get("type") == "hello-ok":
                        print("[BRIDGE] Authorized by Event Bus.")
                    
                    elif data.get("type") == "policy.reloaded":
                        # Re-fetch effective constraints via PIP
                        self.constraints = self.pip.get_effective_constraints()
                        # Update the Kernel with new rules
                        self.kernel.update_constraints(self.constraints)
                        print("[GOVERNANCE] Iron Lattice Updated.")

                    elif data.get("type") == "semantic.context":
                        print(f"[BRIDGE] Semantic Context Update: {len(data['tags'])} objects detected.")
                    
                    elif data.get("type") == "intent.propose":
                        await self.handle_intent(websocket, data)

                    elif data.get("type") == "observation":
                        self.log_observation(data["values"])
                
                sim_task.cancel()

        except Exception as e:
            print(f"[BRIDGE] Error: {e}")

    async def simulate_flight(self, websocket):
        """Autonomous Drone Simulation Loop: Circular Holding Pattern"""
        print("[DRONE] Circular Simulation Loop Engaged.")
        t = 0.0
        dt = 0.1
        pos_x = 20.0
        pos_y = 0.0
        pos_z = 0.0
        
        target_speed = 5.0
        radius = 20.0
        angular_vel = target_speed / radius

        while self.running:
            # 1. Circular Intent Math
            vx = -target_speed * math.sin(angular_vel * t)
            vz = target_speed * math.cos(angular_vel * t)
            intent_value = [vx, 0.0, vz]
            
            # 2. Pass through Kernel for Truncation
            decision, final_value, reason = self.kernel.evaluate_intent("velocity", intent_value)
            
            # 3. PIC Generation for Audit
            pic = self.kernel.generate_pic("intent.propose", intent_value, decision, final_value, reason)
            await websocket.send(json.dumps({"type": "pic.append", "record": pic}))
            
            # 4. Kinematic Update (using governed velocity)
            pos_x += final_value[0] * dt
            pos_z += final_value[2] * dt
            
            # 5. Yaw Orientation (face direction of travel)
            yaw = math.atan2(final_value[0], final_value[2])
            
            # 6. Emit Observation back to Bus
            obs_msg = {
                "type": "observation",
                "values": [
                    pos_x, pos_y, pos_z,             # Position
                    final_value[0], final_value[1], final_value[2], # Velocity (Governed)
                    0.0, 0.0, yaw                    # Pitch, Roll, Yaw
                ]
            }
            await websocket.send(json.dumps(obs_msg))
            
            t += dt
            await asyncio.sleep(dt)

    async def handle_intent(self, websocket, intent):
        # intent: { type: "intent.propose", action: "velocity", value: [x,y,z], ... }
        action = intent.get("action", "velocity")
        value = intent.get("value", [0, 0, 0])
        
        # Zone Evaluation
        decision, result, reason = self.kernel.evaluate_intent(action, value)
        
        # PIC Generation
        pic = self.kernel.generate_pic("intent.propose", value, decision, result, reason)
        
        # Send PIC to Bus for persistence
        await websocket.send(json.dumps({
            "type": "pic.append",
            "record": pic
        }))
        
        if decision == "WARNING":
            print(f"[GOVERNANCE] WARNING: {reason}")
            await websocket.send(json.dumps({
                "type": "governance.warning",
                "message": reason,
                "id": intent.get("id")
            }))
            # Warnings are transparent to execution (Clear the original intent)
            final_decision = "CLEARANCE"
            final_value = value
        elif decision == "VETO":
            print(f"[GOVERNANCE] VETO/TRUNCATION: {reason}")
            # Map VETO to TRUNCATION decision if result is provided
            final_decision = "TRUNCATION"
            final_value = result
        else:
            final_decision = "CLEARANCE"
            final_value = value

        # Send Decision back to Bus
        decision_msg = {
            "type": "intent.decision",
            "id": intent.get("id"),
            "decision": final_decision,
            "value": final_value
        }
        await websocket.send(json.dumps(decision_msg))

    def log_observation(self, values):
        # Convert to MLX and store in rolling buffer
        self.buffer_ptr = (self.buffer_ptr + 1) % self.buffer_size
        if self.buffer_ptr % 100 == 0:
            print(f"[BRIDGE] Observations logged: {self.buffer_ptr}/{self.buffer_size}")

if __name__ == "__main__":
    bridge = PfsdBridge()
    try:
        asyncio.run(bridge.connect())
    except KeyboardInterrupt:
        print("[BRIDGE] Shutting down.")
