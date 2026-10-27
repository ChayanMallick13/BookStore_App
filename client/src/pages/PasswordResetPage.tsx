import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setMessage(data.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to request a password reset.');
    } finally {
      setPending(false);
    }
  }

  return (
    <ResetCard title="Reset your password" description="Enter the email address associated with your account.">
      <form className="mt-8 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block space-y-1.5 text-sm font-medium">
          Email
          <Input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {message && <p role="status" className="text-sm text-green-800">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button className="w-full" variant="accent" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </ResetCard>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This password reset link is missing its token. Request a new link.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { message: 'Password updated. Sign in with your new password.' } });
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'INVALID_OR_EXPIRED_RESET_TOKEN') {
        setError('This reset link is invalid or expired. Request a new link.');
      } else {
        setError(reason instanceof Error ? reason.message : 'Unable to reset your password.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <ResetCard title="Choose a new password" description="Use at least eight characters for your new password.">
      <form className="mt-8 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block space-y-1.5 text-sm font-medium">
          New password
          <Input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Confirm password
          <Input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button className="w-full" variant="accent" disabled={pending || !token}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
        {!token && <p className="text-sm"><Link className="underline" to="/forgot-password">Request a new reset link</Link></p>}
      </form>
    </ResetCard>
  );
}

function ResetCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Books Bin account</p>
        <h1 className="mt-2 font-serif text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">{description}</p>
        {children}
        <p className="mt-6 text-center text-sm text-ink-500"><Link className="underline" to="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
