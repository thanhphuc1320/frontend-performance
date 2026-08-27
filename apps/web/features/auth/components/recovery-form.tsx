'use client';

import React, { useState } from 'react';

interface RecoveryFormProps {
  onSubmit: (email: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function RecoveryForm({ onSubmit, loading, error, success }: RecoveryFormProps) {
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (!email.trim()) {
      setValidationError('Email is required');
      return;
    }
    void onSubmit(email);
  }

  if (success) {
    return (
      <div>
        <p>If this email is registered, you will receive a password reset link. Please check your email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="recovery-email">Email</label>
        <input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      {(error || validationError) && (
        <div role="alert">{error ?? validationError}</div>
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </button>
    </form>
  );
}
