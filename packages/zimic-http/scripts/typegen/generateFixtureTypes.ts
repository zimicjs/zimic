import { execa as $ } from 'execa';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import typegenFixtures from '@/cli/typegen/__tests__/fixtures/typegenFixtures';
import { TypegenFixtureCase, TypegenFixtureCaseName, TypegenFixtureType } from '@/cli/typegen/__tests__/fixtures/types';
import { PossiblePromise } from '@/types/utils';

export async function usingConsoleTime<ReturnType>(
  label: string,
  callback: () => PossiblePromise<ReturnType>,
): Promise<ReturnType> {
  console.time(label);

  try {
    return await callback();
  } finally {
    console.timeEnd(label);
  }
}

const FIXTURE_TYPEGEN_BATCH_SIZE = 15;

async function generateFixtureCaseTypes(fixtureType: TypegenFixtureType, fixtureCase: TypegenFixtureCase) {
  const outputFileName = path.parse(fixtureCase.expectedOutputFileName).base;
  const typegenPrefix = `[typegen] [${fixtureType}] ${outputFileName}`;

  const inputFilePath = path.join(typegenFixtures[fixtureType].directory, fixtureCase.inputFileName);
  const outputFilePath = path.join(typegenFixtures[fixtureType].directory, fixtureCase.expectedOutputFileName);

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
      ...fixtureCase.additionalArguments,
    ];

    await $('node', commandArguments);
  });

  return outputFilePath;
}

async function lintGeneratedFiles(filePaths: string[]) {
  const lintPrefix = '[lint]';

  await usingConsoleTime(lintPrefix, async () => {
    await $('pnpm', ['--silent', 'lint', ...filePaths]);
  });
}

interface FixtureTypegenOptions {
  fixtureType: TypegenFixtureType;
  fixtureNames: TypegenFixtureCaseName[];
}

async function generateFixtureCasesTypes({ fixtureType, fixtureNames }: FixtureTypegenOptions) {
  const fixtureCases = fixtureNames
    .flatMap<TypegenFixtureCase>((fixtureName) => typegenFixtures[fixtureType].cases[fixtureName])
    .filter((fixtureCase) => !fixtureCase.shouldWriteToStdout && !fixtureCase.shouldUseURLAsInput);

  const outputFilePaths: string[] = [];

  for (let batchIndex = 0; batchIndex < fixtureCases.length / FIXTURE_TYPEGEN_BATCH_SIZE; batchIndex++) {
    const batchFixtureCases = fixtureCases.slice(
      batchIndex * FIXTURE_TYPEGEN_BATCH_SIZE,
      (batchIndex + 1) * FIXTURE_TYPEGEN_BATCH_SIZE,
    );

    const newOutputFilePaths = await Promise.all(
      batchFixtureCases.map((fixtureCase) => generateFixtureCaseTypes(fixtureType, fixtureCase)),
    );

    for (const outputFilePath of newOutputFilePaths) {
      outputFilePaths.push(outputFilePath);
    }
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
