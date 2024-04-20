type CommitCallback = () => void;

export interface AsyncCommitOptions {
  onCommit?: CommitCallback;
}

export function registerCommitCallback(value: unknown, onCommit: CommitCallback) {
  void Promise.resolve(value).then(onCommit);
}

export function registerMultipleCommitCallback(values: unknown[], onCommit: CommitCallback) {
  void Promise.all(values).then(onCommit);
}
