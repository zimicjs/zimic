/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when an interceptor starts on a base URL and Socket.IO namespace that a running interceptor handles.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#namespaces Socket.IO namespaces}
 */
class DuplicateSocketIONamespaceError extends Error {
  constructor(namespace: string, baseURL: string) {
    super(
      `The Socket.IO namespace '${namespace}' of ${baseURL} is handled by another running interceptor. Use one ` +
        'interceptor for each namespace.',
    );
    this.name = 'DuplicateSocketIONamespaceError';
  }
}

export default DuplicateSocketIONamespaceError;
