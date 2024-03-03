export function convertHeadersToObject(headers: Headers) {
  const headersAsObject: Record<string, string> = {};

  headers.forEach((value, key) => {
    headersAsObject[key] = value;
  });

  return headersAsObject;
}

export function convertObjectToHeaders(headersAsObject: Record<string, unknown>) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(headersAsObject)) {
    headers.set(key, String(value));
  }

  return headers;
}
