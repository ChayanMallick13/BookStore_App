import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json', 'X-Request-ID': 'test-request-id' }),
    json: async () => body,
  } as Response;
}

function AuthState() {
  const { user, loading, sessionError } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'signed-out'}</span>
      <span data-testid="error">{sessionError ?? ''}</span>
    </div>
  );
}

function renderAuth() {
  return render(<AuthProvider><AuthState /></AuthProvider>);
}

describe('AuthContext session restoration', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('includes cookies on profile requests and refreshes once after an expired access token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(401, { success: false, error: { message: 'Unauthorized' } }))
      .mockResolvedValueOnce(response(200, { success: true, data: { user: { id: '1', role: 'customer' } } }))
      .mockResolvedValueOnce(response(200, {
        success: true,
        data: { id: '1', email: 'reader@example.com', role: 'customer', name: 'Reader' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('reader@example.com'));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
    }
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh');
  });

  it('returns to signed-out state after one failed refresh without looping', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(401, { success: false, error: { message: 'Unauthorized' } }))
      .mockResolvedValueOnce(response(401, { success: false, error: { message: 'Unauthorized' } }));
    vi.stubGlobal('fetch', fetchMock);
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a network failure instead of silently treating it as a valid session', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network failure'));
    vi.stubGlobal('fetch', fetchMock);
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Unable to verify your session'));
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
