export function createInterceptorSavingSafeLimitExceededMessage(options: {
  resourceName: string;
  optionName: string;
  numberOfSavedResources: number;
  safeLimit: number;
  learnMoreURL?: string;
}) {
  const { resourceName, optionName, numberOfSavedResources, safeLimit, learnMoreURL } = options;

  const message =
    `The number of intercepted ${resourceName} saved in memory (${numberOfSavedResources}) exceeded the safe limit ` +
    `of ${safeLimit}. Did you forget to call \`interceptor.clear()\`?\n\n` +
    `If you need to save ${resourceName}, make sure to regularly call \`interceptor.clear()\`. Alternatively, you ` +
    `can hide this warning by increasing \`${optionName}.safeLimit\` in your interceptor. Note that saving too many ` +
    `${resourceName} in memory can lead to performance issues.\n\n` +
    `If you do not need to save ${resourceName}, consider setting \`${optionName}.enabled: false\` in your ` +
    'interceptor.';

  return learnMoreURL === undefined ? message : `${message}\n\nLearn more: ${learnMoreURL}`;
}
