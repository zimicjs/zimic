import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

export type MSWWorker = BrowserMSWWorker | NodeMSWWorker;

export { BrowserMSWWorker, NodeMSWWorker };
