import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryApiError } from './errors';
import {
  fetchDiscoveryNotificationEmail,
  updateDiscoveryNotificationEmail,
} from './client';

describe('Discovery notification email client (E13.3.4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GET maps userNotificationEmail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userNotificationEmail: 'User@Example.com' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchDiscoveryNotificationEmail('sess_1');
    expect(res).toEqual({ userNotificationEmail: 'User@Example.com' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/modules/discovery/notification-email'),
      expect.objectContaining({ cache: 'no-store' })
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.stringify(init)).not.toContain('DISCOVERY_NOTIFICATION_EMAIL');
  });

  it('PATCH set sends email string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userNotificationEmail: 'a@example.com' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await updateDiscoveryNotificationEmail('sess_1', 'a@example.com');
    expect(res).toEqual({ userNotificationEmail: 'a@example.com' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/modules/discovery/notification-email'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ email: 'a@example.com' }),
      })
    );
  });

  it('PATCH clear sends null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userNotificationEmail: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await updateDiscoveryNotificationEmail('sess_1', null);
    expect(res).toEqual({ userNotificationEmail: null });
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ email: null }),
      })
    );
  });

  it('surfaces API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid notification email', code: 'INVALID_REQUEST' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateDiscoveryNotificationEmail('sess_1', 'bad')).rejects.toBeInstanceOf(
      DiscoveryApiError
    );
    await expect(updateDiscoveryNotificationEmail('sess_1', 'bad')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Invalid notification email',
    });
  });
});
