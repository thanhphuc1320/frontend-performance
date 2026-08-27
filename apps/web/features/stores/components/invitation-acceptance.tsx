'use client';

import React, { useState } from 'react';

interface InvitationAcceptanceProps {
  onAccept: (token: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function InvitationAcceptance({ onAccept, loading, error, success }: InvitationAcceptanceProps) {
  const [token, setToken] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (!token.trim()) {
      setValidationError('Token is required');
      return;
    }
    void onAccept(token);
  }

  if (success) {
    return (
      <div>
        <p>You have successfully joined the store.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="invitation-token">Invitation token</label>
        <input
          id="invitation-token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
        />
      </div>
      {(error || validationError) && (
        <div role="alert">{error ?? validationError}</div>
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Accepting...' : 'Accept invitation'}
      </button>
    </form>
  );
}
