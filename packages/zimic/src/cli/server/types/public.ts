export interface PublicServer {
  port: () => number;
  hostname: () => string;
  ephemeral: () => boolean;
  isRunning: () => boolean;

  start: () => Promise<void>;
  stop: () => Promise<void>;
}
