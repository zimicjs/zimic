export const PROCESS_EXIT_EVENTS = Object.freeze([
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const);

export type ProcessExitEvent = (typeof PROCESS_EXIT_EVENTS)[number];

// Having an undefined exit code means that the process will already exit with the default exit code.
export const PROCESS_EXIT_CODE_BY_EXIT_EVENT: Record<string, number | undefined> = {
  beforeExit: undefined,
  uncaughtExceptionMonitor: undefined,
  SIGINT: 130,
  SIGTERM: 143,
  SIGHUP: 129,
  SIGBREAK: 131,
} satisfies Record<ProcessExitEvent, number | undefined>;
