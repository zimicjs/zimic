import { PublicHttpRequestTracker } from './public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpRequestTrackerPath<Tracker extends PublicHttpRequestTracker<any, any, any, any>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tracker extends PublicHttpRequestTracker<any, any, infer Path, any> ? Path : never;
