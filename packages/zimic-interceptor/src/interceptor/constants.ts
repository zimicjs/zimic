export const INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER = '__ZIMIC_INTERCEPTOR_RPC_PROTOCOL__';

export type InterceptorServerRPCProtocol = 'http' | 'ws';

// Servers accept only workers with the same RPC version. Bump it only for breaking changes to the communication between
// interceptors and servers, and release the bump in a minor version.
export const INTERCEPTOR_SERVER_RPC_VERSION = 1;

export const INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER = '__ZIMIC_INTERCEPTOR_RPC_VERSION__';

export const INTERCEPTOR_SERVER_RPC_PACKAGE_VERSION_PARAMETER = '__ZIMIC_INTERCEPTOR_PACKAGE_VERSION__';
