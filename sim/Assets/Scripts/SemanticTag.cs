using System;
using System.Collections.Generic;
using UnityEngine;

namespace Stargate.Simulation
{
    public class SemanticTag : MonoBehaviour
    {
        [Header("Classification")]
        public string objectClass = "generic";
        
        [Header("Security Specifics")]
        public bool isPowerline = false;
        public float voltageKv = 0f;
        public bool isPerson = false;

        /// <summary>
        /// Converts the tag data into logical labels for the PFSD Event Bus.
        /// </summary>
        public Dictionary<string, object> ToLogicLabels()
        {
            return new Dictionary<string, object>
            {
                { "objectClass", objectClass },
                { "isPowerline", isPowerline },
                { "voltageKv", voltageKv },
                { "isPerson", isPerson },
                { "instanceId", gameObject.GetInstanceID() },
                { "position", new float[] { transform.position.x, transform.position.y, transform.position.z } }
            };
        }
    }
}
