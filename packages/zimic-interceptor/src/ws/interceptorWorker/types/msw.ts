import type { WebSocketHandler as MSWWebSocketHandler } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

export type { MSWWebSocketHandler, NodeMSWWorker, BrowserMSWWorker };

export type MSWWorker = NodeMSWWorker | BrowserMSWWorker;
