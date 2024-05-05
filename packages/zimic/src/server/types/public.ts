export interface Server {
  hostname: () => string;
  port: () => number | undefined;
  httpURL: () => string | undefined;
  lifeCycleTimeout: () => number | undefined;
  rpcTimeout: () => number | undefined;
  isRunning: () => boolean;

  start: () => Promise<void>;
  stop: () => Promise<void>;
}
