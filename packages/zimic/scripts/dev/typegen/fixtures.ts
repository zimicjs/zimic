import filesystem from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures/typegenFixtures';
import { TypegenFixtureCase, TypegenFixtureCaseName, TypegenFixtureType } from '@/cli/__tests__/typegen/fixtures/types';
import { usingConsoleTime } from '@/utils/console';
import { runCommand } from '@/utils/processes';
import { prefixLines } from '@/utils/strings';

async function normalizeOutputTypeImports(filePath: string) {
  const fileContent = await filesystem.readFile(filePath, 'utf-8');
  const fileContentWithCorrectImports = fileContent.replace(/ from "zimic";/, " from '@/index';");
  await filesystem.writeFile(filePath, fileContentWithCorrectImports);
}

async function generateFixtureCaseTypes(fixtureType: TypegenFixtureType, fixtureCase: TypegenFixtureCase) {
  const outputFileName = path.parse(fixtureCase.outputFileName).base;
  const typegenPrefix = `[typegen] [${fixtureType}] ${outputFileName}`;

  const inputFilePath = path.join(typegenFixtures[fixtureType].directory, fixtureCase.inputFileName);
  const outputFilePath = path.join(typegenFixtures[fixtureType].directory, fixtureCase.outputFileName);

  await usingConsoleTime(typegenPrefix, async () => {
    const commandArguments = [
      './dist/cli.js',
      'typegen',
      fixtureType,
      inputFilePath,
      '--output',
      outputFilePath,
      '--service-name',
      'my-service',
      ...fixtureCase.commandArguments,
    ];

    await runCommand('node', commandArguments, {
      stdio: 'pipe',
      onOutput(data, type) {
        process[type].write(prefixLines(`${typegenPrefix}: `, data.toString()));
      },
    });
  });

  await normalizeOutputTypeImports(outputFilePath);

  return outputFilePath;
}

async function lintGeneratedFiles(filePaths: string[]) {
  const lintPrefix = '[lint] ';

  await usingConsoleTime(lintPrefix.trim(), async () => {
    await runCommand('pnpm', ['--silent', 'lint', ...filePaths], {
      stdio: 'pipe',
      onOutput(data, type) {
        process[type].write(prefixLines(lintPrefix, data.toString()));
      },
    });
  });
}

const FIXTURE_TYPEGEN_BATCH_SIZE = 5;

interface FixtureTypegenOptions {
  fixtureType: TypegenFixtureType;
  fixtureNames: TypegenFixtureCaseName[];
}

async function generateFixtureCasesTypes({ fixtureType, fixtureNames }: FixtureTypegenOptions) {
  const fixtureCases = fixtureNames
    .flatMap<TypegenFixtureCase>((fixtureName) => typegenFixtures[fixtureType].cases[fixtureName])
    .filter((fixtureCase) => fixtureCase.outputFileName !== '-');

  const outputFilePaths: string[] = [];

  for (let batchIndex = 0; batchIndex < fixtureCases.length / FIXTURE_TYPEGEN_BATCH_SIZE; batchIndex++) {
    const batchFixtureCases = fixtureCases.slice(
      batchIndex * FIXTURE_TYPEGEN_BATCH_SIZE,
      (batchIndex + 1) * FIXTURE_TYPEGEN_BATCH_SIZE,
    );

    const newOutputFilePaths = await Promise.all(
      batchFixtureCases.map((fixtureCase) => generateFixtureCaseTypes(fixtureType, fixtureCase)),
    );

    outputFilePaths.push(...newOutputFilePaths);
  }

  await lintGeneratedFiles(outputFilePaths);
}

async function runFixturesCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic-dev-typegen')
    .version(version)
    .showHelpOnFail(false)
    .demandCommand()
    .strict()

    .command(
      '$0 <fixtureType> <fixtureNames>',
      'Generate development fixture types.',
      (yargs) =>
        yargs
          .positional('fixtureType', {
            type: 'string',
            description: 'The type of fixture to generate.',
            choices: Object.keys(typegenFixtures),
            demandOption: true,
          })
          .positional('fixtureNames', {
            type: 'string',
            description:
              'The names of the fixtures to generate, separated by commas. If `all`, all fixtures will be generated.',
            choices: Object.keys(typegenFixtures.openapi.cases),
            default: 'all',
          }),
      async (cliArguments) => {
        await generateFixtureCasesTypes({
          fixtureType: cliArguments.fixtureType,
          fixtureNames: cliArguments.fixtureNames.split(/\W+/) as TypegenFixtureCaseName[],
        });
      },
    )

    .parse();
}

void runFixturesCLI();
