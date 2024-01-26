import axios, { AxiosError } from 'axios';

import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';

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
