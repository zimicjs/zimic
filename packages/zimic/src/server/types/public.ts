export interface PublicServer {
  hostname: () => string;
  port: () => number | undefined;
  isRunning: () => boolean;

  start: () => Promise<void>;
  stop: () => Promise<void>;
}
