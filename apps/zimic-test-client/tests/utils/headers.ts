export function convertHeadersToObject(headers: Headers) {
  const headersAsObject: Record<string, string> = {};

  headers.forEach((value, key) => {
    headersAsObject[key] = value;
  });

  return headersAsObject;
}

export function convertObjectToHeaders(headers: Record<string, unknown>) {
  const headersAsObject = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    headersAsObject.set(key, String(value));
  }

  return headersAsObject;
}
