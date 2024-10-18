import chalk from 'chalk';

import { OpenAPITypegenOptions, typegen } from '@/typegen';
import { logWithPrefix } from '@/utils/console';
import { usingElapsedTime, formatElapsedTime } from '@/utils/time';

async function generateTypesFromOpenAPI(options: OpenAPITypegenOptions) {
  const executionSummary = await usingElapsedTime(async () => {
    await typegen.generateFromOpenAPI(options);
  });

  const outputFilePath = options.output;

  const successMessage =
    `${chalk.green.bold('✔')} Generated ` +
    `${outputFilePath ? chalk.green(outputFilePath) : `to ${chalk.yellow('stdout')}`} ` +
    `${chalk.dim(`(${formatElapsedTime(executionSummary.elapsedTime)})`)}`;

  const hasWrittenToStdout = outputFilePath === undefined;
  logWithPrefix(successMessage, { method: hasWrittenToStdout ? 'warn' : 'log' });
}

export default generateTypesFromOpenAPI;
