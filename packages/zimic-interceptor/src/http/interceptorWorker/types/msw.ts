import type { HttpHandler as MSWHandler } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

export type { MSWHandler, NodeMSWWorker, BrowserMSWWorker };

export type MSWWorker = NodeMSWWorker | BrowserMSWWorker;
