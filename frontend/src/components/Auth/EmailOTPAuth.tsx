import React, { useState } from 'react';
import * as api from '../../services/api';
import type { User } from '../../types';

interface EmailOTPAuthProps {
  onSuccess: (user: User) => void | Promise<void>;
}

export const EmailOTPAuth: React.FC<EmailOTPAuthProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.requestOTP(email.trim());
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const user = await api.verifyOTP(email.trim(), otp.trim());
      await onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div data-testid="otp-form-container" className="flex flex-col gap-4">
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-dim)' }}>
          Code sent to <span style={{ color: 'var(--c-accent)' }}>{email}</span>
        </p>
        {error && (
          <p data-testid="auth-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
            {error}
          </p>
        )}
        <form data-testid="otp-form" onSubmit={handleVerifyOTP} className="flex flex-col gap-3">
          <input
            data-testid="otp-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            autoComplete="one-time-code"
            autoFocus
            className="pollis-input text-center font-mono tracking-widest text-base"
          />
          <button
            data-testid="verify-otp-button"
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-2"
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <button
          data-testid="back-to-email-button"
          onClick={() => { setStep('email'); setOtp(''); setError(null); }}
          className="text-xs font-mono text-center"
          style={{ color: 'var(--c-text-muted)' }}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div data-testid="email-form-container" className="flex flex-col gap-4">
      {error && (
        <p data-testid="auth-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
          {error}
        </p>
      )}
      <form data-testid="email-form" onSubmit={handleRequestOTP} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="email-input"
            className="text-2xs font-mono uppercase tracking-widest"
            style={{ color: 'var(--c-text-muted)' }}
          >
            Email
          </label>
          <input
            id="email-input"
            data-testid="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            className="pollis-input"
          />
        </div>
        <button
          data-testid="send-otp-button"
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-2"
        >
          {isLoading ? 'Sending…' : 'Continue'}
        </button>
      </form>
    </div>
  );
};
