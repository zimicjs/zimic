import type { HttpHandler as MSWHttpHandler } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

export type { MSWHttpHandler, NodeMSWWorker, BrowserMSWWorker };

export type MSWWorker = NodeMSWWorker | BrowserMSWWorker;
