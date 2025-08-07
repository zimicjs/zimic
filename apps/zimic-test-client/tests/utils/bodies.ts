export function requestCanHaveBody(request: Request) {
  return request.method !== 'GET' && request.method !== 'HEAD';
}
