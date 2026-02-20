import hashlib
import json
import numpy as np
from datetime import datetime

class PFSDKernel:
    def __init__(self, constraints):
        self.constraints = constraints
        # Genesis hash rule
        self.prev_hash = hashlib.sha256("STARGATE_GENESIS".encode()).hexdigest()

    def update_constraints(self, constraints):
        """Hot-swaps the kernel constraints."""
        self.constraints = constraints
        print(f"[KERNEL] Constraints updated: {list(self.constraints.keys())}")

    @staticmethod
    def compute_hash(data, prev_hash):
        """Merkle Link: sha256(json_string(data) + prev_hash)"""
        # Ensure deterministic JSON matching Node.js default (no spaces)
        data_str = json.dumps(data, sort_keys=True, default=str, separators=(',', ':'))
        return hashlib.sha256((data_str + prev_hash).encode()).hexdigest()

    def evaluate_intent(self, intent_type, value):
        """
        Evaluates an intent against constraints.
        Supports: velocity (vector)
        """
        if intent_type == "velocity":
            return self._evaluate_velocity(value)
        
        # Default to safe clearance for unknown types in this MVP
        return "CLEARANCE", value, None

    def _evaluate_velocity(self, intent_v3):
        # intent_v3: list or np.array [x, y, z]
        v = np.array(intent_v3)
        mag = np.linalg.norm(v)
        
        rules = self.constraints.get("MAX_VELOCITY", {
            "limit": 5.0,
            "warning_threshold": 4.0
        })
        
        limit = rules.get("limit", 5.0)
        warning = rules.get("warning_threshold", 4.0)

        if mag > limit:
            # Zone 3: VETO/TRUNCATION
            scale = limit / mag
            truncated = (v * scale).tolist()
            return "VETO", truncated, f"Velocity {mag:.2f}m/s exceeds limit {limit}m/s. Truncated."
        
        elif mag > warning:
            # Zone 2: Warning
            return "WARNING", intent_v3, f"Velocity {mag:.2f}m/s exceeds warning threshold {warning}m/s."
        
        else:
            # Zone 1: Safe
            return "CLEARANCE", intent_v3, None

    def generate_pic(self, event_type, intent, decision, result_value, reason=None):
        """Generates a Merkle-hashed PIC entry."""
        event_data = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "intent": intent,
            "decision": decision,
            "result": result_value,
            "reason": reason,
            "prev_hash": self.prev_hash
        }
        
        current_hash = self.compute_hash(event_data, self.prev_hash)
        event_data["hash"] = current_hash
        
        # Advance the chain
        self.prev_hash = current_hash
        return event_data

if __name__ == "__main__":
    # Test
    constraints = {"MAX_VELOCITY": {"limit": 5.0, "warning_threshold": 4.0}}
    kernel = PFSDKernel(constraints)
    
    # Test Safe
    d, v, r = kernel.evaluate_intent("velocity", [1, 0, 1])
    print(f"Safe: {d}, {v}, {r}")
    
    # Test Warning
    d, v, r = kernel.evaluate_intent("velocity", [3, 0, 3]) # mag ~ 4.24
    print(f"Warning: {d}, {v}, {r}")
    
    # Test Veto
    d, v, r = kernel.evaluate_intent("velocity", [5, 0, 5]) # mag ~ 7.07
    print(f"Veto: {d}, {v}, {r}")
    
    pic = kernel.generate_pic("intent.propose", [5,0,5], d, v, r)
    print(f"PIC: {json.dumps(pic, indent=2)}")
