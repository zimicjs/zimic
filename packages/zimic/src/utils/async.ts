export interface AsyncCommitOptions {
  onCommit?: () => void;
}

export function registerCommitCallback(value: unknown, onCommit: AsyncCommitOptions['onCommit'] | undefined) {
  void Promise.resolve(value).then(onCommit);
}

export function registerMultipleCommitCallback(
  values: unknown[],
  onCommit: AsyncCommitOptions['onCommit'] | undefined,
) {
  void Promise.all(values).then(onCommit);
}
