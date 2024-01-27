import { dirname } from 'path';
import { fileURLToPath } from 'url';

export function isESModule() {
  return typeof require === 'undefined' && typeof module !== 'undefined' && typeof module.exports === 'undefined';
}

export function isCommonJS() {
  return !isESModule();
}

export function getFileName() {
  return isESModule() ? fileURLToPath(import.meta.url) : __filename;
}

export function getFileDirectory() {
  return dirname(getFileName());
}
