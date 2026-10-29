import type { ServerResponse } from 'http';

// Browsers may resend requests whose connection closes without a response. Conflicting content lengths make Chromium,
// Firefox, and Node.js' fetch fail the request once with a network error. Lenient clients may report unexpected content
// length or receive an empty 500 instead.
const INVALID_REJECTED_RESPONSE = [
  'HTTP/1.1 500 Internal Server Error',
  'Content-Length: 0',
  'Content-Length: 1',
  '',
  '',
].join('\r\n');

export function rejectNodeResponse(nodeResponse: ServerResponse) {
  if (nodeResponse.headersSent) {
    nodeResponse.destroy();
    return;
  }

  // Write to the socket directly because Node.js rejects conflicting content lengths in `ServerResponse`.
  nodeResponse.socket?.end(INVALID_REJECTED_RESPONSE);
}
