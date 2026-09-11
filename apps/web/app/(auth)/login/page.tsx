'use client';

import { LoginForm } from '../../../features/auth/components/login-form';
import { useLogin } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function LoginPage() {
  const login = useLogin();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Commerce Control Center</h1>
        <p className="text-text-secondary mt-1">Sign in to your account</p>
      </div>
      <LoginForm
        onSubmit={(data) => login.mutate(data)}
        loading={login.isPending}
        error={login.error instanceof ApiError ? login.error.message : null}
        errorCode={login.error instanceof ApiError ? login.error.code : null}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Don't have an account?{' '}
        <a href="/register" className="text-primary hover:underline">Register</a>
      </p>
    </div>
  );
}
