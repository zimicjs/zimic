import glob from 'fast-glob';
import filesystem from 'fs/promises';
import path from 'path';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures';
import { runCommand } from '@/utils/processes';
import { prefixLines } from '@/utils/strings';

async function findAllFixtureNames(fixtureType: string) {
  const filePaths = await glob([path.join(typegenFixtures.directory, fixtureType, '*'), '!**/*.ts']);

  return filePaths.map((filePath) => {
    const fileName = path.parse(filePath).name;
    return fileName;
  });
}

async function generateFixtureTypes(fixtureName: string, fixtureType: string, otherArguments: string[]) {
  const fixtureDirectory = path.join(typegenFixtures.directory, fixtureType);
  const schemaFilePath = path.join(fixtureDirectory, `${fixtureName}.yaml`);

  const fileName = path.parse(schemaFilePath).name;
  const removesComments = otherArguments.some((otherArgument) => {
    return otherArgument === '--remove-comments' || otherArgument === '--remove-comments=true';
  });

  const outputFilePath = path.join(fixtureDirectory, removesComments ? `${fileName}.ts` : `${fileName}.comments.ts`);

  const typegenPrefix = `[typegen] [${fixtureName}]${removesComments ? '' : ' (with comments)'} `;
  console.time(typegenPrefix.trim());

  await runCommand(
    'node',
    [
      './dist/cli.js',
      'typegen',
      fixtureType,
      schemaFilePath,
      '--output',
      outputFilePath,
      '--service-name',
      'my-service',
      ...otherArguments,
    ],
    {
      stdio: 'pipe',
      onOutput(data, type) {
        process[type].write(prefixLines(typegenPrefix, data.toString()));
      },
    },
  );

  console.timeEnd(typegenPrefix.trim());

  const outputFileContent = await filesystem.readFile(outputFilePath, 'utf-8');
  await filesystem.writeFile(outputFilePath, outputFileContent.replace(/ from "zimic";/, " from '@/index';"));

  return outputFilePath;
}

async function generateAllFixtureTypes(fixtureName: string, fixtureType: string, otherArguments: string[]) {
  const removeCommentOptions = [true, false];

  const typegenPromises = removeCommentOptions.map((removeComments) =>
    generateFixtureTypes(fixtureName, fixtureType, [...otherArguments, `--remove-comments=${removeComments}`]),
  );

  return Promise.all(typegenPromises);
}

async function lintGeneratedFiles(filePaths: string[]) {
  const lintPrefix = '[lint] ';
  console.time(lintPrefix.trim());

  await runCommand('pnpm', ['lint', ...filePaths], {
    stdio: 'pipe',
    onOutput(data, type) {
      process[type].write(prefixLines(lintPrefix, data.toString()));
    },
  });

  console.timeEnd(lintPrefix.trim());
}

async function generateBaseFixtureTypes() {
  const [fixtureType, joinedFixtureNames, ...otherArguments] = process.argv.slice(2);

  const shouldIncludeAllFixtures = joinedFixtureNames === 'all';

  const fixtureNames = shouldIncludeAllFixtures
    ? await findAllFixtureNames(fixtureType)
    : joinedFixtureNames.split(/\W+/);

  const isSomeCommentRemovalSpecified = otherArguments.some((otherArgument) =>
    otherArgument.startsWith('--remove-comments'),
  );

  const typegenPromises = fixtureNames.map(async (fixtureName) => {
    if (isSomeCommentRemovalSpecified) {
      return generateFixtureTypes(fixtureName, fixtureType, otherArguments);
    } else {
      return generateAllFixtureTypes(fixtureName, fixtureType, otherArguments);
    }
  });

  const outputFilePaths = (await Promise.all(typegenPromises)).flat();

  await lintGeneratedFiles(outputFilePaths);
}

void generateBaseFixtureTypes();
