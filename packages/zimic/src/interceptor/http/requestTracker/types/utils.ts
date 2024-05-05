import { HttpRequestTracker } from './public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpRequestTrackerPath<Tracker extends HttpRequestTracker<any, any, any, any>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tracker extends HttpRequestTracker<any, any, infer Path, any> ? Path : never;
