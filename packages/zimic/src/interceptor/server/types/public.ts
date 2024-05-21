export interface InterceptorServer {
  hostname: () => string;
  port: () => number | undefined;
  httpURL: () => string | undefined;
  isRunning: () => boolean;

  start: () => Promise<void>;
  stop: () => Promise<void>;
}
