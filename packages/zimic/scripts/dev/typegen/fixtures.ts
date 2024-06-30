import glob from 'fast-glob';
import filesystem from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures';
import { usingConsoleTime } from '@/utils/console';
import { isNonEmpty } from '@/utils/data';
import { runCommand } from '@/utils/processes';
import { prefixLines } from '@/utils/strings';

const TYPEGEN_FIXTURE_TYPES = ['openapi'] as const;
type TypegenFixtureType = (typeof TYPEGEN_FIXTURE_TYPES)[number];

async function findAllAvailableFixtureNames(fixtureType: TypegenFixtureType) {
  const fixtureFilePaths = await glob([path.join(typegenFixtures.directory, fixtureType, '*'), '!**/*.ts']);
  const fixtureFileNames = fixtureFilePaths.map((filePath) => path.parse(filePath).name);
  return fixtureFileNames;
}

async function getFixtureNames(joinedFixtureNames: string, fixtureType: TypegenFixtureType) {
  const shouldIncludeAllFixtures = joinedFixtureNames === 'all';

  const fixtureNames = shouldIncludeAllFixtures
    ? await findAllAvailableFixtureNames(fixtureType)
    : joinedFixtureNames.split(/\W+/);

  return fixtureNames;
}

async function normalizeOutputTypeImports(filePath: string) {
  const fileContent = await filesystem.readFile(filePath, 'utf-8');
  const fileContentWithCorrectImports = fileContent.replace(/ from "zimic";/, " from '@/index';");
  await filesystem.writeFile(filePath, fileContentWithCorrectImports);
}

async function runFixtureTypeGeneration(typegenPrefix: string, commandArguments: string[], outputFilePath: string) {
  await usingConsoleTime(typegenPrefix.trim(), async () => {
    await runCommand('node', commandArguments, {
      stdio: 'pipe',
      onOutput(data, type) {
        process[type].write(prefixLines(typegenPrefix, data.toString()));
      },
    });
  });

  await normalizeOutputTypeImports(outputFilePath);
}

interface FilterCommandArguments {
  arguments: string[];
  outputFilePath: string;
  typegenAdditionalPrefix?: string;
}

function createFilterCommandArguments(
  baseCommandArguments: string[],
  outputFilePathWithoutExtension: string,
): FilterCommandArguments[] {
  return [
    {
      arguments: [...baseCommandArguments, '--filter', 'GET /users'],
      outputFilePath: `${outputFilePathWithoutExtension}.oneMethod.ts`,
      typegenAdditionalPrefix: `-one-method`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET,PUT /users/:userId'],
      outputFilePath: `${outputFilePathWithoutExtension}.multipleMethods.ts`,
      typegenAdditionalPrefix: `-multiple-methods`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', '* /users/:userId'],
      outputFilePath: `${outputFilePathWithoutExtension}.wildcardMethod.ts`,
      typegenAdditionalPrefix: `-wildcard-method`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET *'],
      outputFilePath: `${outputFilePathWithoutExtension}.pathWildcard.1.ts`,
      typegenAdditionalPrefix: `-path-wildcard-1`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET **'],
      outputFilePath: `${outputFilePathWithoutExtension}.pathWildcard.2.ts`,
      typegenAdditionalPrefix: `-path-wildcard-2`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET /users**'],
      outputFilePath: `${outputFilePathWithoutExtension}.pathWildcard.3.ts`,
      typegenAdditionalPrefix: `-path-wildcard-3`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET /users/**'],
      outputFilePath: `${outputFilePathWithoutExtension}.pathWildcard.4.ts`,
      typegenAdditionalPrefix: `-path-wildcard-4`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', 'GET /users/**/*'],
      outputFilePath: `${outputFilePathWithoutExtension}.pathWildcard.5.ts`,
      typegenAdditionalPrefix: `-path-wildcard-5`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', '!GET /users'],
      outputFilePath: `${outputFilePathWithoutExtension}.negative.1.ts`,
      typegenAdditionalPrefix: `-negative-1`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', '!* /users**'],
      outputFilePath: `${outputFilePathWithoutExtension}.negative.2.ts`,
      typegenAdditionalPrefix: `-negative-2`,
    },
    {
      arguments: [...baseCommandArguments, '--filter', '!GET /users/**/*'],
      outputFilePath: `${outputFilePathWithoutExtension}.negative.3.ts`,
      typegenAdditionalPrefix: `-negative-3`,
    },
    {
      arguments: [
        ...baseCommandArguments,
        '--filter',
        'POST /users',
        '--filter',
        '* /users/**/*',
        '--filter',
        '!PATCH /users/:userId',
        '--filter',
        'DELETE /notifications',
      ],
      outputFilePath: `${outputFilePathWithoutExtension}.multiple.ts`,
      typegenAdditionalPrefix: `-multiple`,
    },
  ];
}

async function generateFixtureTypes(
  fixtureName: string,
  fixtureType: TypegenFixtureType,
  options: { removeComments?: boolean },
) {
  const fixtureDirectory = path.join(typegenFixtures.directory, fixtureType);
  const inputFilePath = path.join(fixtureDirectory, `${fixtureName}.yaml`);

  const fileName = path.parse(inputFilePath).name;

  const outputFilePathWithoutExtension = path.join(
    fixtureDirectory,
    options.removeComments ? fileName : `${fileName}.comments`,
  );

  const removeCommentsFlag = options.removeComments === undefined ? '' : `--remove-comments=${options.removeComments}`;
  const typegenPrefix = `[typegen-${fixtureName}${options.removeComments ? '' : '-comments'}`;

  const baseCommandArguments = [
    './dist/cli.js',
    'typegen',
    fixtureType,
    inputFilePath,
    '--service-name',
    'my-service',
    removeCommentsFlag,
  ].filter(isNonEmpty);

  const filterCommandsArguments =
    fileName === 'filters' && options.removeComments
      ? createFilterCommandArguments(baseCommandArguments, outputFilePathWithoutExtension)
      : [];

  const commands: FilterCommandArguments[] = [
    { arguments: baseCommandArguments, outputFilePath: `${outputFilePathWithoutExtension}.ts` },
    ...filterCommandsArguments,
  ];

  const typegenPromises = commands.map(async (commands) => {
    await runFixtureTypeGeneration(
      `${typegenPrefix}${commands.typegenAdditionalPrefix ?? ''}] `,
      [...commands.arguments, '--output', commands.outputFilePath],
      commands.outputFilePath,
    );

    return commands.outputFilePath;
  });

  return Promise.all(typegenPromises);
}

async function generateAllFixtureTypes(
  fixtureName: string,
  fixtureType: TypegenFixtureType,
  options: { removeComments?: boolean },
) {
  const removeCommentsOptions = [true, false];

  const typegenPromises = removeCommentsOptions.map(async (removeComments) => {
    return generateFixtureTypes(fixtureName, fixtureType, { ...options, removeComments });
  });

  return Promise.all(typegenPromises);
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

async function generateBaseFixtureTypes(
  fixtureType: TypegenFixtureType,
  joinedFixtureNames: string,
  options: { removeComments?: boolean },
) {
  const fixtureNames = await getFixtureNames(joinedFixtureNames, fixtureType);

  const outputFilePaths: string[] = [];

  for (const fixtureName of fixtureNames) {
    if (options.removeComments === undefined) {
      const newOutputFilePaths = await generateAllFixtureTypes(fixtureName, fixtureType, options);
      outputFilePaths.push(...newOutputFilePaths.flat());
    } else {
      const newOutputFilePaths = await generateFixtureTypes(fixtureName, fixtureType, options);
      outputFilePaths.push(...newOutputFilePaths);
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
            choices: TYPEGEN_FIXTURE_TYPES,
            demandOption: true,
          })
          .positional('fixtureNames', {
            type: 'string',
            description:
              'The names of the fixtures to generate, separated by commas. If `all`, all fixtures will be generated.',
            demandOption: true,
          })
          .option('remove-comments', {
            type: 'boolean',
            description: 'Whether to remove comments from the generated types.',
          }),
      async (cliArguments) => {
        await generateBaseFixtureTypes(cliArguments.fixtureType, cliArguments.fixtureNames, {
          removeComments: cliArguments.removeComments,
        });
      },
    )

    .parse();
}

void runFixturesCLI();
