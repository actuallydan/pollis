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
      <div data-testid="otp-form-container">
        <p>Enter the 6-digit code sent to {email}</p>
        {error && <p data-testid="auth-error">{error}</p>}
        <form data-testid="otp-form" onSubmit={handleVerifyOTP}>
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
          />
          <button data-testid="verify-otp-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
        <button
          data-testid="back-to-email-button"
          onClick={() => {
            setStep('email');
            setOtp('');
            setError(null);
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div data-testid="email-form-container">
      {error && <p data-testid="auth-error">{error}</p>}
      <form data-testid="email-form" onSubmit={handleRequestOTP}>
        <label htmlFor="email-input">Email address</label>
        <input
          id="email-input"
          data-testid="email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />
        <button data-testid="send-otp-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Code'}
        </button>
      </form>
    </div>
  );
};
