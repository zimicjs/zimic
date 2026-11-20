/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
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
