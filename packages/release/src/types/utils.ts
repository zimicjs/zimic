// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callable<Parameters extends readonly unknown[], ReturnType> = (
  ...parameters: Parameters
) => Promise<ReturnType>;
