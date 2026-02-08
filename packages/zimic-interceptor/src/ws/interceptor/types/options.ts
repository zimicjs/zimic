export type WebSocketInterceptorType = 'local' | 'remote';

export type WebSocketInterceptorPlatform = 'node' | 'browser';

// TODO: Check if @zimic/interceptor/ws should support unhandled messages. Could we have unhandled messages? What about
// unhandled websocket handshakes?
// export namespace UnhandledMessageStrategy {
//   export type LocalAction = 'bypass' | 'reject';

//   export type RemoteAction = 'reject';

//   export type Action = LocalAction | RemoteAction;

//   export interface Declaration<DeclarationAction extends Action = Action> {
//     action: DeclarationAction;
//     log?: boolean;
//   }

//   export type DeclarationFactory<DeclarationAction extends Action = Action> = (
//     message: InterceptedWebSocketInterceptorMessage<WebSocketSchema>,
//   ) => PossiblePromise<Declaration<DeclarationAction>>;

//   export type LocalDeclaration = Declaration<LocalAction>;

//   export type LocalDeclarationFactory = DeclarationFactory<LocalAction>;

//   export type RemoteDeclaration = Declaration<RemoteAction>;

//   export type RemoteDeclarationFactory = DeclarationFactory<RemoteAction>;

//   export type Local = LocalDeclaration | LocalDeclarationFactory;

//   export type Remote = RemoteDeclaration | RemoteDeclarationFactory;
// }

// export type UnhandledMessageStrategy = UnhandledMessageStrategy.Local | UnhandledMessageStrategy.Remote;

export interface WebSocketInterceptorMessageSaving {
  enabled: boolean;
  safeLimit: number;
}

export interface SharedWebSocketInterceptorOptions {
  type?: WebSocketInterceptorType;
  baseURL: string;
  requestSaving?: Partial<WebSocketInterceptorMessageSaving>;
}

export interface LocalWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type?: 'local';
}

export interface RemoteWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type: 'remote';
}

export type WebSocketInterceptorOptions = LocalWebSocketInterceptorOptions | RemoteWebSocketInterceptorOptions;
