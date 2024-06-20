import glob from 'fast-glob';
import path from 'path';

export function findGeneratedTypeScriptFiles(directory: string) {
  return glob(path.join(directory, 'generated', '**', '*.output.ts'));
}

export function findGeneratedJSONFiles(directory: string) {
  return glob(path.join(directory, 'generated', '**', '*.json'));
}

export function findYAMLFiles(directory: string, fileNamePattern = '*') {
  return glob(path.join(directory, '**', `${fileNamePattern}.yaml`));
}

export function normalizeTypegenFileToCompare(fileContent: string) {
  return fileContent.replace(/^\s*\/\/ eslint-disable-next-.+$/gm, '').replace(/\n{2,}/g, '\n');
}
