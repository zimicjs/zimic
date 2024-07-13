import chalk from 'chalk';

class Logger {
  private nextStep = 1;

  constructor(private totalSteps?: number) {}

  progress(message: string) {
    if (this.totalSteps === undefined) {
      console.log(`${chalk.dim('[...]')} ${message}`);
    } else {
      console.log(`${chalk.dim(`[${this.nextStep++}/${this.totalSteps}]`)} ${message}`);
    }
  }

  info(message: string) {
    console.log(`${chalk.blue('info')} ${message}`);
  }

  success(message: string) {
    console.log(`${chalk.green('success')} ${message}`);
  }

  warn(message: string) {
    console.warn(`${chalk.yellow('warn')} ${message}`);
  }

  error(message: string) {
    console.error(`${chalk.red('error')} ${message}`);
  }
}

export default Logger;
