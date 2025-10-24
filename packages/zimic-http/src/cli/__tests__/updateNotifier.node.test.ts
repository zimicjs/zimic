import type updateNotifier from 'update-notifier';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('update-notifier', () => ({
  default: vi.fn(),
}));

describe('Update notifier', () => {
  let updateNotifierMock: ReturnType<typeof vi.fn>;
  let notifyMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const updateNotifierModule = (await import('update-notifier')) as { default: typeof updateNotifier };
    updateNotifierMock = vi.mocked(updateNotifierModule.default);

    notifyMock = vi.fn();
    updateNotifierMock.mockReturnValue({
      notify: notifyMock,
      check: vi.fn(),
      fetchInfo: vi.fn(),
    } as unknown as ReturnType<typeof updateNotifier>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should check for updates when CLI is imported', async () => {
    const { checkForUpdates } = await import('../updateNotifier');

    checkForUpdates();

    expect(updateNotifierMock).toHaveBeenCalledTimes(1);
    expect(updateNotifierMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pkg: {
          name: '@zimic/http',
          version: expect.any(String) as string,
        },
        updateCheckInterval: 1000 * 60 * 60 * 24, // 24 hours
      }) as Parameters<typeof updateNotifier>[0],
    );

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith({
      defer: false,
      isGlobal: false,
    });
  });
});
