using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Unity.MLAgents;
using Unity.MLAgents.Actuators;
using Unity.MLAgents.Sensors;
using Unity.MLAgents.SideChannels;

namespace Stargate.Simulation
{
    public class DroneAgent : Agent
    {
        public Rigidbody rb;
        public float thrustStrength = 20f;
        
        private SemanticTagBridge semanticBridge;

        public override void Initialize()
        {
            rb = GetComponent<Rigidbody>();
            
            // Register SideChannel
            semanticBridge = new SemanticTagBridge(transform);
            SideChannelManager.RegisterSideChannel(semanticBridge);
        }

        public override void OnStepTimeout()
        {
            // Optional: Handle timeouts
        }

        public override void CollectObservations(VectorSensor sensor)
        {
            // Observations: Pos(3), Vel(3), Rot(4), AngVel(3) = 13 total
            sensor.AddObservation(transform.localPosition);
            sensor.AddObservation(rb.velocity);
            sensor.AddObservation(transform.localRotation);
            sensor.AddObservation(rb.angularVelocity);
            
            // Send Semantic Updates via SideChannel
            semanticBridge.SendSemanticUpdates();
        }

        public override void OnActionReceived(ActionBuffers actions)
        {
            // 4 Continuous Actions: Thrust for individual motors
            // actions.ContinuousActions[0] -> Front Left
            // actions.ContinuousActions[1] -> Front Right
            // actions.ContinuousActions[2] -> Back Left
            // actions.ContinuousActions[3] -> Back Right

            float fl = Mathf.Clamp01(actions.ContinuousActions[0]);
            float fr = Mathf.Clamp01(actions.ContinuousActions[1]);
            float bl = Mathf.Clamp01(actions.ContinuousActions[2]);
            float br = Mathf.Clamp01(actions.ContinuousActions[3]);

            // Governance Hook: In actual implementation, these would be filtered by the PFSD Event Bus
            // For now, we apply them directly as intent cleared by the bridge
            
            ApplyThrust(new Vector3(-0.5f, 0, 0.5f), fl);
            ApplyThrust(new Vector3(0.5f, 0, 0.5f), fr);
            ApplyThrust(new Vector3(-0.5f, 0, -0.5f), bl);
            ApplyThrust(new Vector3(0.5f, 0, -0.5f), br);
        }

        private void ApplyThrust(Vector3 offset, float strength)
        {
            Vector3 worldOffset = transform.TransformDirection(offset);
            rb.AddForceAtPosition(transform.up * strength * thrustStrength, transform.position + worldOffset);
        }

        public override void Heuristic(in ActionBuffers actionsOut)
        {
            var continuousActions = actionsOut.ContinuousActions;
            // Simple hover heuristic
            continuousActions[0] = Input.GetKey(KeyCode.Space) ? 1.0f : 0.0f;
            continuousActions[1] = Input.GetKey(KeyCode.Space) ? 1.0f : 0.0f;
            continuousActions[2] = Input.GetKey(KeyCode.Space) ? 1.0f : 0.0f;
            continuousActions[3] = Input.GetKey(KeyCode.Space) ? 1.0f : 0.0f;
        }

        private void OnDestroy()
        {
            if (Academy.IsInitialized)
            {
                SideChannelManager.UnregisterSideChannel(semanticBridge);
            }
        }
    }
}
