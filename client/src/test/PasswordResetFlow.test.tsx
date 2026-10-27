import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';

function response(status: number, data?: unknown, error?: { code?: string; message?: string }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => status >= 200 && status < 300
      ? { success: true, data }
      : { success: false, error: { code: error?.code, message: error?.message ?? 'Request failed' } },
  } as Response;
}

function signedOutFetch(extra: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/auth/me') || url.endsWith('/auth/refresh')) {
      return response(401, undefined, { message: 'Unauthorized' });
    }
    if (url.endsWith('/catalog/categories')) return response(200, []);
    return extra(url, init);
  });
}

describe('public password reset flow', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders forgot-password while signed out and submits the public API route', async () => {
    const fetchMock = signedOutFetch((url, init) => {
      expect(url.endsWith('/auth/forgot-password')).toBe(true);
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'reader@example.com' });
      return response(200, { message: 'If the email exists, reset instructions were sent.' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter initialEntries={['/forgot-password']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Reset your password' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('If the email exists');
  });

  it('loads reset-password directly while signed out and resets a valid link', async () => {
    const fetchMock = signedOutFetch((url, init) => {
      expect(url.endsWith('/auth/reset-password')).toBe(true);
      expect(JSON.parse(String(init?.body))).toEqual({ token: 'valid token+/=', password: 'new-password' });
      return response(200, { message: 'Password updated' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter initialEntries={['/reset-password?token=valid%20token%2B%2F%3D']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Choose a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    });
  });

  it('shows an invalid-link message instead of a route not-found page', async () => {
    const fetchMock = signedOutFetch((_url, _init) => response(
      404,
      undefined,
      { code: 'INVALID_OR_EXPIRED_RESET_TOKEN', message: 'This password reset link is invalid or expired.' },
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter initialEntries={['/reset-password?token=invalid']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Choose a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or expired');
    expect(screen.queryByText('404 · Page not found')).not.toBeInTheDocument();
  });

  it('does not enable an account reset request from an empty token', async () => {
    vi.stubGlobal('fetch', signedOutFetch(() => response(200, [])));

    render(<MemoryRouter initialEntries={['/reset-password']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Choose a new password' });
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('keeps an unauthenticated admin route protected', async () => {
    vi.stubGlobal('fetch', signedOutFetch(() => response(200, [])));

    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Welcome back' });
  });
});
