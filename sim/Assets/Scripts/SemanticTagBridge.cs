using System;
using System.Collections.Generic;
using UnityEngine;
using Unity.MLAgents;
using Unity.MLAgents.SideChannels;
using System.Text;

namespace Stargate.Simulation
{
    /// <summary>
    /// Bridges Unity SemanticTags to the Python PFSD Bridge via ML-Agents SideChannel.
    /// </summary>
    public class SemanticTagBridge : SideChannel
    {
        private float scanRadius = 30.0f;
        private Transform droneTransform;

        public SemanticTagBridge(Transform drone)
        {
            ChannelId = new Guid("621f0a1c-5296-414c-83b4-e2da182b8b9a");
            droneTransform = drone;
        }

        protected override void OnMessageReceived(IncomingMessage msg)
        {
            // Handle incoming logic queries or policy constraints from Python if needed
        }

        /// <summary>
        /// Scans for SemanticTags in radius and sends updates to the Python Bridge.
        /// </summary>
        public void SendSemanticUpdates()
        {
            Collider[] colliders = Physics.OverlapSphere(droneTransform.position, scanRadius);
            List<Dictionary<string, object>> detectedTags = new List<Dictionary<string, object>>();

            foreach (var col in colliders)
            {
                if (col.TryGetComponent<SemanticTag>(out var tag))
                {
                    detectedTags.Add(tag.ToLogicLabels());
                }
            }

            if (detectedTags.Count > 0)
            {
                string json = Newtonsoft.Json.JsonConvert.SerializeObject(new {
                    type = "semantic.context",
                    timestamp = Time.time,
                    tags = detectedTags
                });

                using (var msg = new OutgoingMessage())
                {
                    msg.WriteString(json);
                    QueueMessageToSend(msg);
                }
            }
        }
    }
}
