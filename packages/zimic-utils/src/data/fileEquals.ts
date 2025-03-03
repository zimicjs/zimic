import blobEquals from './blobEquals';

async function fileEquals(file: File, otherFile: File) {
  return file.name === otherFile.name && (await blobEquals(file, otherFile));
}

export default fileEquals;
