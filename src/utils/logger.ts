import chalk from 'chalk';

export const logger = {
    info: (msg: string) => console.log(chalk.blue(`[INFO]  ${msg}`)),
    success: (msg: string) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    warn: (msg: string) => console.log(chalk.yellow(`[WARN]  ${msg}`)),
    error: (msg: string) => console.log(chalk.red(`[ERROR] ${msg}`)),
    bus: (msg: string) => console.log(chalk.magenta(`[BUS]   ${msg}`)),
    cli: (msg: string) => console.log(chalk.cyan(`[CLI]   ${msg}`)),
};
