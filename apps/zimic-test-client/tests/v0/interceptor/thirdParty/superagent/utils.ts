import superagent from 'superagent';
import SuperagentResponse from 'superagent/lib/node/response';

import { requestCanHaveBody } from '@tests/utils/bodies';
import { convertHeadersToObject } from '@tests/utils/headers';

export async function superagentAsFetch(request: Request): Promise<Response> {
  let superAgentRequest = superagent(request.method, request.url).set(convertHeadersToObject(request.headers));

  if (requestCanHaveBody(request)) {
    superAgentRequest = superAgentRequest.send(await request.text());
  }

  try {
    const superAgentResponse = await superAgentRequest;

    const responseBody = superAgentResponse.status === 204 ? null : superAgentResponse.text;

    return new Response(responseBody, {
      status: superAgentResponse.status,
      headers: superAgentResponse.headers,
    });
  } catch (error) {
    /* istanbul ignore next -- @preserve
     * Ignoring as this is expected not to be covered. */
    if (!(error instanceof Error) || !('response' in error)) {
      throw error;
    }

    const { response: superagentResponse } = error as Error & { response: SuperagentResponse };

    return new Response(superagentResponse.text, {
      status: superagentResponse.status,
      headers: superagentResponse.headers,
    });
  }
}
