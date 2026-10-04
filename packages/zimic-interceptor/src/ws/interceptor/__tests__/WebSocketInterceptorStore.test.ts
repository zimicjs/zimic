import { afterEach, describe, expect, it } from 'vitest';

import WebSocketInterceptorStore from '../WebSocketInterceptorStore';

describe('WebSocketInterceptorStore', () => {
  afterEach(() => {
    new WebSocketInterceptorStore().deleteLocalWorker();
  });

  it('should reuse a local worker across store instances', () => {
    const firstStore = new WebSocketInterceptorStore();
    const secondStore = new WebSocketInterceptorStore();

    const worker = firstStore.getOrCreateLocalWorker({});

    expect(secondStore.getOrCreateLocalWorker({})).toBe(worker);
  });
});
