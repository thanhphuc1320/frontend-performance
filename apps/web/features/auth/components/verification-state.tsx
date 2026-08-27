'use client';

import React from 'react';

interface VerificationStateProps {
  status: 'loading' | 'success' | 'error' | 'expired';
  error?: string | null;
}

export function VerificationState({ status, error }: VerificationStateProps) {
  if (status === 'loading') {
    return <div>Verifying your email...</div>;
  }

  if (status === 'success') {
    return <div>Your email has been verified. You can now log in.</div>;
  }

  if (status === 'expired') {
    return <div>This verification link has expired. Please request a new one.</div>;
  }

  return (
    <div>
      <div>Verification failed.</div>
      {error && <div role="alert">{error}</div>}
    </div>
  );
}
