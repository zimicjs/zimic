import { ProcessPromise, ProcessOutput } from 'zx';

export function withCommandOutputs(processPromise: ProcessPromise<ProcessOutput>): ProcessPromise<ProcessOutput> {
  processPromise.stdout.pipe(process.stdout);
  processPromise.stderr.pipe(process.stderr);
  return processPromise;
}
