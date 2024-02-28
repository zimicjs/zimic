import { JSONValue } from '@/types/json';

/** The default body type (JSON) for HTTP requests and responses. */
export type DefaultBody = JSONValue;

/** An HTTP request with a strictly-typed JSON body. */
export interface HttpRequest<StrictBody extends DefaultBody = DefaultBody> extends Request {
  json: () => Promise<StrictBody>;
}

/** An HTTP response with a strictly-typed JSON body and status code. */
export interface HttpResponse<StrictBody extends DefaultBody = DefaultBody, StatusCode extends number = number>
  extends Response {
  status: StatusCode;
  json: () => Promise<StrictBody>;
}
