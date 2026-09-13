'use client';

import Link from 'next/link';
import { RecoveryForm } from '../../../features/auth/components/recovery-form';
import { useRequestPasswordReset } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function RecoveryPage() {
  const reset = useRequestPasswordReset();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Reset password</h1>
        <p className="text-text-secondary mt-1">We'll send you a link to reset your password</p>
      </div>
      <RecoveryForm
        onSubmit={(email) => reset.mutate(email)}
        loading={reset.isPending}
        error={reset.error instanceof ApiError ? reset.error.message : null}
        success={reset.isSuccess}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Remember your password?{' '}
        <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
