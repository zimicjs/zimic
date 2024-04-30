type CommitCallback = () => void;

export interface AsyncCommitOptions {
  onCommit?: CommitCallback;
}
