import { createCachedDynamicImport } from '@zimic/utils/import';
import type { SharedOptions as MSWWorkerSharedOptions } from 'msw';

import { isClientSide, isServerSide } from '@/utils/environment';

import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import type { BrowserMSWWorker, MSWWorker, NodeMSWWorker } from './types/msw';

const importMSWNode = createCachedDynamicImport(() => import('msw/node'));
const importMSWBrowser = createCachedDynamicImport(() => import('msw/browser'));

class LocalMSWWorkerStore {
  private static mswWorker?: MSWWorker;
  private static creatingMSWWorkerPromise?: Promise<MSWWorker>;
  private static isMSWWorkerRunning = false;
  private static startingMSWWorkerPromise?: Promise<void>;
  private static numberOfRunningWorkers = 0;

  private class = LocalMSWWorkerStore;

  get mswWorker() {
    return this.class.mswWorker;
  }

  async getMSWWorkerOrCreate(options: { createUnknownPlatformError: () => Error }) {
    if (this.class.mswWorker) {
      return this.class.mswWorker;
    }

    this.class.creatingMSWWorkerPromise ??= this.createMSWWorker(options)
      .then((mswWorker) => {
        this.class.mswWorker = mswWorker;
        return mswWorker;
      })
      .finally(() => {
        this.class.creatingMSWWorkerPromise = undefined;
      });

    return this.class.creatingMSWWorkerPromise;
  }

  private async createMSWWorker(options: { createUnknownPlatformError: () => Error }) {
    if (isServerSide()) {
      const mswNode = await importMSWNode();

      /* istanbul ignore else -- @preserve */
      if ('setupServer' in mswNode) {
        return mswNode.setupServer();
      }
    }

    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      const mswBrowser = await importMSWBrowser();

      /* istanbul ignore else -- @preserve */
      if ('setupWorker' in mswBrowser) {
        return mswBrowser.setupWorker();
      }
    }

    /* istanbul ignore next -- @preserve */
    throw options.createUnknownPlatformError();
  }

  async startMSWWorker(mswWorker: MSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    if (!this.class.isMSWWorkerRunning) {
      this.class.startingMSWWorkerPromise ??= this.startMSWWorkerOnce(mswWorker, sharedOptions)
        .then(() => {
          this.class.isMSWWorkerRunning = true;
        })
        .finally(() => {
          this.class.startingMSWWorkerPromise = undefined;
        });

      await this.class.startingMSWWorkerPromise;
    }

    this.class.numberOfRunningWorkers++;
  }

  private async startMSWWorkerOnce(mswWorker: MSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    if (this.isInternalBrowserWorker(mswWorker)) {
      try {
        await mswWorker.start({ ...sharedOptions, quiet: true });
      } catch (error) {
        /* istanbul ignore else -- @preserve
         * Browser worker start errors other than unregistered service workers come from MSW internals. */
        if (UnregisteredBrowserServiceWorkerError.matchesRawError(error)) {
          throw new UnregisteredBrowserServiceWorkerError();
        } else {
          throw error;
        }
      }
    } else {
      mswWorker.listen(sharedOptions);
    }
  }

  stopMSWWorker(mswWorker: MSWWorker) {
    this.class.numberOfRunningWorkers = Math.max(this.class.numberOfRunningWorkers - 1, 0);

    if (this.class.numberOfRunningWorkers > 0) {
      return;
    }

    if (this.isInternalBrowserWorker(mswWorker)) {
      // Browser workers are kept running because restarting them can cause interception issues in MSW.
    } else {
      mswWorker.close();
      this.class.isMSWWorkerRunning = false;
    }
  }

  isMSWWorkerRunning() {
    return this.class.isMSWWorkerRunning;
  }

  isInternalBrowserWorker(worker: MSWWorker): worker is BrowserMSWWorker {
    return 'start' in worker && 'stop' in worker;
  }

  /* istanbul ignore next -- @preserve
   * Current callers use the browser-worker guard directly; this is a convenience inverse. */
  isInternalNodeWorker(worker: MSWWorker): worker is NodeMSWWorker {
    return !this.isInternalBrowserWorker(worker);
  }
}

export default LocalMSWWorkerStore;
