import fs from 'fs';
import yaml from 'js-yaml';

export async function convertYAMLToJSONFile(yamlFilePath: string, jsonFilePath: string) {
  const yamlFileContent = await fs.promises.readFile(yamlFilePath, 'utf-8');
  const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);
  await fs.promises.writeFile(jsonFilePath, jsonFileContent);
}
