interface PromiseWithResolvers<ResolvedValue> extends Promise<ResolvedValue> {
  resolve: (value: ResolvedValue | PromiseLike<ResolvedValue>) => void;
  reject: (reason?: unknown) => void;
}

function createPromiseWithResolvers<ResolvedValue = void>(): PromiseWithResolvers<ResolvedValue> {
  let resolvePromise: ((value: ResolvedValue | PromiseLike<ResolvedValue>) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  }) as PromiseWithResolvers<ResolvedValue>;

  return Object.assign(promise, {
    resolve: resolvePromise,
    reject: rejectPromise,
  });
}

export default createPromiseWithResolvers;
