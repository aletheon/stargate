import os from 'os';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger.js';
import { saveConfig } from '../../utils/config.js';

const CONFIG_DIR = path.join(os.homedir(), '.pfsd');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SA_FILE = 'eleutherios-mvp-sa.json';

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
        if (!proceed) process.exit(0);
    } else {
        logger.success('Hardware Verified: Apple M2 Silicon detected.');
    }

    // 2. Firebase Verification
    if (!fs.existsSync(SA_FILE)) {
        logger.error(`Service account file ${SA_FILE} not found in project root.`);
        process.exit(1);
    }
    logger.success('Firebase Service Account verified.');

    // 3. Genesis Seeding
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(SA_FILE, 'utf-8'));
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(serviceAccount)
            });
        }
        const db = getFirestore();
        const policyRef = db.doc('artifacts/stargate/public/data/policy_registry/root_flight_axioms');
        const doc = await policyRef.get();

        if (!doc.exists) {
            logger.cli('Seeding Genesis Policy (root_flight_axioms)...');
            await policyRef.set({
                id: 'root_flight_axioms',
                name: 'Root Flight Axioms',
                constraints: {
                    MAX_VELOCITY: {
                        limit: 5.0,
                        warning_threshold: 4.0
                    }
                },
                metadata: {
                    version: 'v9.7',
                    createdAt: FieldValue.serverTimestamp()
                }
            });
            logger.success('Genesis Policy seeded successfully.');
        } else {
            logger.info('Genesis Policy already exists.');
        }
    } catch (err) {
        logger.error(`Firebase/Genesis error: ${err}`);
        process.exit(1);
    }

    // 4. Interactive Config
    let tailscaleMode = 'off';
    if (!process.env.ST_NON_INTERACTIVE) {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'tailscaleMode',
                message: 'Select Tailscale Integration Mode:',
                choices: ['off', 'serve', 'funnel'],
                default: 'off'
            }
        ]);
        tailscaleMode = answers.tailscaleMode;
    }

    // 5. Config Scaffolding
    const config = {
        tailscale: { mode: tailscaleMode },
        pairedDevices: []
    };

    try {
        saveConfig(config as any);
        fs.chmodSync(CONFIG_FILE, 0o600);
        logger.success('Configuration saved to ~/.pfsd/config.json (Permissions: 600)');
    } catch (err) {
        logger.error(`Failed to save config: ${err}`);
        process.exit(1);
    }

    logger.success('Onboarding Complete! You can now start the PFSD Event Bus.');
}
