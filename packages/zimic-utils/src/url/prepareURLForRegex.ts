export function prepareURLForRegex(url: string) {
  const encodedURL = encodeURI(url);
  return encodedURL.replace(/([.()*?+$\\])/g, '\\$1');
}
