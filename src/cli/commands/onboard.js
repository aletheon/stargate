import os from 'os';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { saveConfig } from '../../utils/config.js';
export async function onboard() {
    logger.cli('Starting Stargate Onboarding Wizard...');
    // 1. M2 Verification
    const cpus = os.cpus();
    const isM2 = cpus.some(cpu => cpu.model.includes('Apple M2'));
    if (!isM2) {
        logger.warn('Non-M2 architecture detected. System may not perform optimally.');
        const { proceed } = await inquirer.prompt([{
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to proceed anyway?',
                default: false
            }]);
        if (!proceed)
            process.exit(0);
    }
    else {
        logger.success('Hardware Verified: Apple M2 Silicon detected.');
    }
    // 2. Interactive Config
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'tailscaleMode',
            message: 'Select Tailscale Integration Mode:',
            choices: ['off', 'serve', 'funnel'],
            default: 'off'
        }
    ]);
    // 3. Config Scaffolding
    const config = {
        tailscale: { mode: answers.tailscaleMode },
        pairedDevices: []
    };
    try {
        saveConfig(config);
        logger.success('Configuration saved to ~/.pfsd/config.json (Permissions: 600)');
    }
    catch (err) {
        logger.error(`Failed to save config: ${err}`);
        process.exit(1);
    }
    logger.success('Onboarding Complete! You can now start the PFSD Event Bus.');
}
//# sourceMappingURL=onboard.js.map