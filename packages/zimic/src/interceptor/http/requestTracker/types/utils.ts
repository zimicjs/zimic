import { LocalHttpRequestTracker, RemoteHttpRequestTracker } from './public';

export type HttpRequestTrackerPath<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tracker,
> =
  Tracker extends LocalHttpRequestTracker<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    ? Path
    : Tracker extends RemoteHttpRequestTracker<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      ? Path
      : never;
