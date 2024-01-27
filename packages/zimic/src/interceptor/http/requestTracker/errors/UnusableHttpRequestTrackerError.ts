class UnusableHttpRequestTrackerError extends Error {
  constructor() {
    super(
      'Current trackers become unusable after their interceptor is cleared. To apply new responses, create ' +
        'new trackers.',
    );
    this.name = 'UnusableHttpRequestTrackerError';
  }
}

export default UnusableHttpRequestTrackerError;
