import axios, { AxiosError } from 'axios';

import { requestCanHaveBody } from '@tests/utils/bodies';
import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';

export async function axiosAsFetch(request: Request, options: { adapter?: 'fetch' } = {}): Promise<Response> {
  try {
    const axiosResponse = await axios({
      url: request.url,
      method: request.method,
      headers: convertHeadersToObject(request.headers),
      data: requestCanHaveBody(request) ? await request.text() : undefined,
      adapter: options.adapter,
      // axios caches its fetch adapter with the `Request` global from when the adapter was built. If that happens while
      // MSW is patching the globals, the cached `Request` keeps calling MSW's raw header recording after MSW restores
      // `Headers`, which throws `inferRawHeaders(...) is not iterable`. Passing the current `Request` makes axios use
      // an adapter matching it. TODO: Remove when MSW is removed (https://github.com/zimicjs/zimic/issues/1375).
      env: { Request: globalThis.Request },
    });

    const stringifiedResponseData = axiosResponse.status === 204 ? null : JSON.stringify(axiosResponse.data);

    return new Response(stringifiedResponseData, {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: convertObjectToHeaders({ ...axiosResponse.headers }),
    });
  } catch (error) {
    let axiosError: AxiosError | null = null;

    /* istanbul ignore else -- @preserve
     * Ignoring as a safeguard that is not expected to be covered. */
    if (error instanceof AxiosError) {
      axiosError = error;
    }

    /* istanbul ignore next -- @preserve
     * Ignoring as a safeguard that is not expected to be covered. */
    if (!axiosError?.response) {
      throw error;
    }

    const axiosResponse = axiosError.response;
    const responseBody = JSON.stringify(axiosResponse.data);

    return new Response(responseBody, {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: convertObjectToHeaders({ ...axiosResponse.headers }),
    });
  }
}
