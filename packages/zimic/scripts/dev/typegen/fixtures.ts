import filesystem from 'fs/promises';
import path from 'path';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures';
import { runCommand } from '@/utils/processes';

async function generateBaseFixtureType(fixtureName: string, fixtureType: string, otherArguments: string[]) {
  const fixtureDirectory = path.join(typegenFixtures.directory, fixtureType);
  const schemaFilePath = path.join(fixtureDirectory, `${fixtureName}.yaml`);

  const fileName = path.parse(schemaFilePath).name;

  const removesComments = otherArguments.some(
    (otherArgument, index) =>
      otherArgument === '--remove-comments=true' ||
      (otherArgument === '--remove-comments' && otherArguments.at(index + 1) !== 'false'),
  );
  const outputFilePath = path.join(fixtureDirectory, removesComments ? `${fileName}.ts` : `${fileName}.comments.ts`);

  await runCommand('pnpm', [
    'cli',
    'typegen',
    fixtureType,
    schemaFilePath,
    '--output',
    outputFilePath,
    '--service-name',
    'my-service',
    ...otherArguments,
  ]);

  const outputFileContent = await filesystem.readFile(outputFilePath, 'utf-8');
  await filesystem.writeFile(outputFilePath, outputFileContent.replace(/ from "zimic";/, " from '@/index';"));

  return outputFilePath;
}

async function generateBaseFixtureTypes() {
  const [fixtureType, joinedFixtureNames, ...otherArguments] = process.argv.slice(2);
  const fixtureNames = joinedFixtureNames.split(/\W+/);

  const outputFilePaths = await Promise.all(
    fixtureNames.map((fixtureName) => generateBaseFixtureType(fixtureName, fixtureType, otherArguments)),
  );

  await runCommand('pnpm', ['lint', ...outputFilePaths]);
}

void generateBaseFixtureTypes();
