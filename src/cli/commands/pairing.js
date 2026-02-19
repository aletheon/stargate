import { loadConfig, saveConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
export async function approve(role, code) {
    const config = loadConfig();
    const deviceIndex = config.pairedDevices.findIndex(d => d.pairingCode === code);
    if (deviceIndex === -1) {
        logger.error(`No pending device found with pairing code: ${code}`);
        return;
    }
    const device = config.pairedDevices[deviceIndex];
    if (device) {
        device.approved = true;
        device.role = role;
        delete device.pairingCode;
        saveConfig(config);
        logger.success(`Device ${device.deviceId} approved with role: ${role}`);
    }
}
//# sourceMappingURL=pairing.js.map