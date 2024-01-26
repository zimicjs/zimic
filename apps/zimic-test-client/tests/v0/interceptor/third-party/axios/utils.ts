import axios, { AxiosError } from 'axios';

import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';

export async function axiosAsFetch(request: Request): Promise<Response> {
  try {
    const axiosResponse = await axios({
      url: request.url,
      method: request.method,
      headers: convertHeadersToObject(request.headers),
      data: await request.text(),
    });

    return new Response(axiosResponse.status === 204 ? null : JSON.stringify(axiosResponse.data), {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: convertObjectToHeaders({ ...axiosResponse.headers }),
    });
  } catch (error) {
    if (!(error instanceof AxiosError) || !error.response) {
      throw error;
    }

    const axiosResponse = error.response;

    return new Response(JSON.stringify(axiosResponse.data), {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: convertObjectToHeaders({ ...axiosResponse.headers }),
    });
  }
}
