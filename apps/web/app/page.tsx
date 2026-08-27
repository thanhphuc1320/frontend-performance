'use client';

import React, { useState } from 'react';
import { useSession, useLogin, useLogout, useRegister, useRequestPasswordReset } from '../features/auth/queries';
import { useStores, useSelectStore, useCreateFirstStore, useAcceptInvitation, useCapabilities } from '../features/stores/queries';
import { RegisterForm } from '../features/auth/components/register-form';
import { LoginForm } from '../features/auth/components/login-form';
import { RecoveryForm } from '../features/auth/components/recovery-form';
import { VerificationState } from '../features/auth/components/verification-state';
import { CreateStoreForm } from '../features/stores/components/create-store-form';
import { StoreSwitcher } from '../features/stores/components/store-switcher';
import { InvitationAcceptance } from '../features/stores/components/invitation-acceptance';
import { AccessDenied } from '../features/stores/components/access-denied';
import { ApiError } from '../features/auth/api';

type View = 'login' | 'register' | 'recovery' | 'verify-email' | 'store-onboarding' | 'dashboard';

export default function Page() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: capabilities } = useCapabilities();
  const login = useLogin();
  const logout = useLogout();
  const register = useRegister();
  const requestPasswordReset = useRequestPasswordReset();
  const selectStore = useSelectStore();
  const createStore = useCreateFirstStore();
  const acceptInvitation = useAcceptInvitation();

  const [view, setView] = useState<View>('login');

  const isAuthenticated = !!session?.userId;
  const hasStore = (stores?.length ?? 0) > 0;

  function handleLogin(data: { email: string; password: string }) {
    login.mutate(data, {
      onSuccess: () => setView('dashboard'),
      onError: () => {},
    });
  }

  function handleRegister(data: { email: string; password: string }) {
    register.mutate(data);
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => setView('login'),
    });
  }

  function handleSelectStore(storeId: string) {
    selectStore.mutate(storeId);
  }

  function handleCreateStore(data: { name: string }) {
    createStore.mutate(data);
  }

  function handleAcceptInvitation(token: string) {
    acceptInvitation.mutate(token);
  }

  if (sessionLoading) {
    return <main><p>Loading...</p></main>;
  }

  if (!isAuthenticated) {
    return (
      <main>
        <h1>Commerce Control Center</h1>
        <nav>
          <button type="button" onClick={() => setView('login')}>Sign in</button>
          <button type="button" onClick={() => setView('register')}>Register</button>
          <button type="button" onClick={() => setView('recovery')}>Forgot password</button>
        </nav>
        {view === 'login' && (
          <LoginForm
            onSubmit={handleLogin}
            loading={login.isPending}
            error={login.error instanceof ApiError ? login.error.message : null}
            errorCode={login.error instanceof ApiError ? login.error.code : null}
          />
        )}
        {view === 'register' && (
          <RegisterForm
            onSubmit={handleRegister}
            loading={register.isPending}
            error={register.error instanceof ApiError ? register.error.message : null}
            success={register.isSuccess}
          />
        )}
        {view === 'recovery' && (
          <RecoveryForm
            onSubmit={(email) => requestPasswordReset.mutate(email)}
            loading={requestPasswordReset.isPending}
            error={requestPasswordReset.error instanceof ApiError ? requestPasswordReset.error.message : null}
            success={requestPasswordReset.isSuccess}
          />
        )}
        {view === 'verify-email' && (
          <VerificationState status="loading" error={null} />
        )}
      </main>
    );
  }

  if (selectStore.error instanceof ApiError && selectStore.error.status === 403) {
    return (
      <main>
        <AccessDenied detail="You do not have access to this store." />
        <button type="button" onClick={handleLogout}>Sign out</button>
      </main>
    );
  }

  if (!hasStore) {
    return (
      <main>
        <h1>Welcome</h1>
        <p>You are not part of any store yet.</p>
        <nav>
          <button type="button" onClick={() => setView('store-onboarding')}>Create store</button>
          <button type="button" onClick={() => setView('register')}>Accept invitation</button>
        </nav>
        {view === 'store-onboarding' && (
          <CreateStoreForm
            onSubmit={handleCreateStore}
            loading={createStore.isPending}
            error={createStore.error instanceof ApiError ? createStore.error.message : null}
            success={createStore.isSuccess}
          />
        )}
        {view === 'register' && (
          <InvitationAcceptance
            onAccept={handleAcceptInvitation}
            loading={acceptInvitation.isPending}
            error={acceptInvitation.error instanceof ApiError ? acceptInvitation.error.message : null}
            success={acceptInvitation.isSuccess}
          />
        )}
        <button type="button" onClick={handleLogout}>Sign out</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Commerce Control Center</h1>
      <nav>
        <button type="button" onClick={handleLogout}>Sign out</button>
      </nav>
      <section>
        <h2>Your stores</h2>
        <StoreSwitcher
          stores={stores ?? []}
          loading={storesLoading}
          onSelect={handleSelectStore}
        />
      </section>
      {capabilities && (
        <section>
          <h2>Capabilities</h2>
          <ul>
            {capabilities.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
