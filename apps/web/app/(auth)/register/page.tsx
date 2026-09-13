'use client';

import Link from 'next/link';
import { RegisterForm } from '../../../features/auth/components/register-form';
import { useRegister } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function RegisterPage() {
  const register = useRegister();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
        <p className="text-text-secondary mt-1">Get started with Commerce Control Center</p>
      </div>
      <RegisterForm
        onSubmit={(data) => register.mutate(data)}
        loading={register.isPending}
        error={register.error instanceof ApiError ? register.error.message : null}
        success={register.isSuccess}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
