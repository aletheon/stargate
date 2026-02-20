import firebase_admin
from firebase_admin import credentials, firestore
import json

class MonotonicityError(Exception):
    """Raised when a child policy attempts to relax a parent constraint."""
    pass

class PIP:
    def __init__(self, sa_path="eleutherios-mvp-sa.json"):
        self.sa_path = sa_path
        if not firebase_admin._apps:
            cred = credentials.Certificate(self.sa_path)
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()
        self.registry_path = "artifacts/stargate/public/data/policy_registry"

    def fetch_policy(self, policy_id):
        doc_ref = self.db.collection(self.registry_path).document(policy_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise FileNotFoundError(f"Policy {policy_id} not found in registry.")
        return doc.to_dict()

    def resolve_recursive(self, policy_id, parent_constraints=None):
        policy = self.fetch_policy(policy_id)
        current_constraints = policy.get("constraints", {})

        # Monotonicity Check
        if parent_constraints:
            for key, child_cfg in current_constraints.items():
                if key in parent_constraints:
                    parent_cfg = parent_constraints[key]
                    # MAX constraint check: child limit must be <= parent limit
                    if "limit" in child_cfg and "limit" in parent_cfg:
                        if child_cfg["limit"] > parent_cfg["limit"]:
                            raise MonotonicityError(
                                f"Monotonicity Violation: {policy_id} relaxes {key} "
                                f"({child_cfg['limit']} > {parent_cfg['limit']})"
                            )
                    # Warning threshold check: child threshold must be <= parent threshold
                    if "warning_threshold" in child_cfg and "warning_threshold" in parent_cfg:
                        if child_cfg["warning_threshold"] > parent_cfg["warning_threshold"]:
                            raise MonotonicityError(
                                f"Monotonicity Violation: {policy_id} relaxes warning threshold for {key} "
                                f"({child_cfg['warning_threshold']} > {parent_cfg['warning_threshold']})"
                            )

        # Composition (Start with current, override with parent if present for missing pieces, 
        # though the logic here is usually that child inherits parent's strictest)
        effective = parent_constraints.copy() if parent_constraints else {}
        for key, cfg in current_constraints.items():
            if key not in effective:
                effective[key] = cfg
            else:
                # Merge: Take the strictest values
                if "limit" in cfg:
                    effective[key]["limit"] = min(effective[key].get("limit", float('inf')), cfg["limit"])
                if "warning_threshold" in cfg:
                    effective[key]["warning_threshold"] = min(effective[key].get("warning_threshold", float('inf')), cfg["warning_threshold"])

        # Resolve Children via Instantiation Rules
        instantiations = policy.get("instantiations", [])
        for child_id in instantiations:
            effective = self.resolve_recursive(child_id, effective)

        return effective

    def get_effective_constraints(self, root_policy_id="root_flight_axioms"):
        print(f"[PIP] Resolving effective constraints for {root_policy_id}...")
        try:
            constraints = self.resolve_recursive(root_policy_id)
            print(f"[PIP] Resolution complete. Constraints: {json.dumps(constraints)}")
            return constraints
        except Exception as e:
            print(f"[PIP] Resolution failed: {e}")
            raise

if __name__ == "__main__":
    pip = PIP()
    try:
        constraints = pip.get_effective_constraints()
        print(constraints)
    except Exception as e:
        print(f"Error: {e}")
