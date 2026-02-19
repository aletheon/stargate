import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger.js';
const CONFIG_DIR = path.join(os.homedir(), '.pfsd');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    tailscale: { mode: 'off' },
    pairedDevices: [],
};
export function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        return DEFAULT_CONFIG;
    }
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        logger.error(`Failed to load config: ${error}`);
        return DEFAULT_CONFIG;
    }
}
export function saveConfig(config) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
export function generatePairingCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
//# sourceMappingURL=config.js.map