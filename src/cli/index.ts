#!/usr/bin/env node
import { Command } from 'commander';
import { onboard } from './commands/onboard.js';
import { doctor } from './commands/doctor.js';
import { approve } from './commands/pairing.js';

const program = new Command();

program
    .name('pfsd')
    .description('Stargate Policy-Governed Autonomous System CLI')
    .version('1.0.0');

program
    .command('onboard')
    .description('Interactive onboarding wizard for Stargate')
    .action(onboard);

program
    .command('doctor')
    .description('Run system diagnostics')
    .action(doctor);

const pairing = program.command('pairing').description('Device pairing management');

pairing
    .command('approve')
    .description('Approve a pending device')
    .argument('<role>', 'Role to assign (console, bridge, drone)')
    .argument('<code>', '6-character alphanumeric pairing code')
    .action(approve);

program.parse();
