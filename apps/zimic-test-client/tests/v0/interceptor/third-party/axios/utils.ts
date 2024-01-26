import axios, { AxiosError } from 'axios';

function convertHeadersToObject(headers: Headers) {
  const headersAsObject: Record<string, string> = {};

  headers.forEach((value, key) => {
    headersAsObject[key] = value;
  });

  return headersAsObject;
}

function convertObjectToHeaders(headers: Record<string, unknown>) {
  const headersAsObject = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    headersAsObject.set(key, String(value));
  }

  return headersAsObject;
}

export async function axiosAsFetch(request: Request): Promise<Response> {
  try {
    const response = await axios({
      url: request.url,
      method: request.method,
      headers: convertHeadersToObject(request.headers),
      data: await request.text(),
    });

    return new Response(response.status === 204 ? null : JSON.stringify(response.data), {
      status: response.status,
      statusText: response.statusText,
      headers: convertObjectToHeaders({ ...response.headers }),
    });
  } catch (error) {
    if (!(error instanceof AxiosError) || !error.response) {
      throw error;
    }

    return new Response(JSON.stringify(error.response.data), {
      status: error.response.status,
      statusText: error.response.statusText,
      headers: convertObjectToHeaders({ ...error.response.headers }),
    });
  }
}
