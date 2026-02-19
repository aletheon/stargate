import chalk from 'chalk';
export const logger = {
    info: (msg) => console.log(chalk.blue(`[INFO]  ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    warn: (msg) => console.log(chalk.yellow(`[WARN]  ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    bus: (msg) => console.log(chalk.magenta(`[BUS]   ${msg}`)),
    cli: (msg) => console.log(chalk.cyan(`[CLI]   ${msg}`)),
};
//# sourceMappingURL=logger.js.map