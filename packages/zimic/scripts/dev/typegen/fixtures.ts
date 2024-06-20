import path from 'path';

import typegenFixtures from '@/cli/__tests__/typegen/fixtures';
import { findYAMLFiles } from '@/cli/__tests__/typegen/utils';
import { runCommand } from '@/utils/processes';

async function generateBaseFixtureTypes() {
  const [fixtureType, fixtureName, ...otherArguments] = process.argv.slice(2);

  const fixtureDirectory = path.join(typegenFixtures.directory, fixtureType);
  const schemaFilePaths = await findYAMLFiles(fixtureDirectory, fixtureName);

  for (const filePath of schemaFilePaths) {
    const fileName = path.parse(filePath).name;

    const removesComments = otherArguments.includes('--remove-comments');
    const outputFilePath = path.join(
      typegenFixtures.openapiDirectory,
      removesComments ? `${fileName}.ts` : `${fileName}.comments.ts`,
    );

    await runCommand('pnpm', [
      'cli',
      'typegen',
      fixtureType,
      filePath,
      '--output',
      outputFilePath,
      '--service-name',
      'my-service',
      ...otherArguments,
    ]);
  }
}

void generateBaseFixtureTypes();
