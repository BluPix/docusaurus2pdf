import chalk from 'chalk';

export const colors = {
  success: (msg: string) => console.log(chalk.green('✓ ' + msg)),
  warning: (msg: string) => console.log(chalk.yellow('⚠ ' + msg)),
  error: (msg: string) => console.error(chalk.red('✗ ' + msg)),
  info: (msg: string) => console.log(chalk.cyan('ℹ ' + msg)),
  title: (msg: string) => console.log(chalk.bold.blue(msg)),
};
