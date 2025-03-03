import filesystem from 'fs/promises';
import yaml from 'js-yaml';

export async function convertYAMLToJSONFile(yamlFilePath: string, jsonFilePath: string) {
  const yamlFileContent = await filesystem.readFile(yamlFilePath, 'utf-8');
  const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);
  await filesystem.writeFile(jsonFilePath, jsonFileContent);
}
