import glob from 'fast-glob';
import path from 'path';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures';
import { runCommand } from '@/utils/processes';

async function generateBaseFixtureTypes() {
  const [fixtureType, fixtureName, ...otherArguments] = process.argv.slice(2);

  const fixtureDirectory = path.join(typegenFixtures.directory, fixtureType);
  const schemaFilePaths = await glob(path.join(fixtureDirectory, `${fixtureName}.yaml`));

  for (const schemaFilePath of schemaFilePaths) {
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

    await runCommand('pnpm', ['style:format', outputFilePath]);
    await runCommand('pnpm', ['lint', outputFilePath]);
  }
}

void generateBaseFixtureTypes();
