'use client';

import { useSession } from '../../features/auth/queries';
import { useStores, useSelectStore, useCreateFirstStore, useCapabilities } from '../../features/stores/queries';
import { CreateStoreForm } from '../../features/stores/components/create-store-form';
import { StoreSwitcher } from '../../features/stores/components/store-switcher';
import { InvitationAcceptance } from '../../features/stores/components/invitation-acceptance';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { ApiError } from '../../features/auth/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: capabilities } = useCapabilities();
  const selectStore = useSelectStore();
  const createStore = useCreateFirstStore();
  const [showInvite, setShowInvite] = useState(false);

  if (sessionLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session?.userId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please sign in to continue</p>
        <Button onClick={() => router.push('/login')}>Sign in</Button>
      </div>
    );
  }

  const hasStore = (stores?.length ?? 0) > 0;

  if (!hasStore) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Welcome!</h1>
          <p className="text-text-secondary mt-2">You are not part of any store yet.</p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Button variant={showInvite ? 'ghost' : 'default'} onClick={() => setShowInvite(false)}>
            Create store
          </Button>
          <Button variant={showInvite ? 'default' : 'ghost'} onClick={() => setShowInvite(true)}>
            Accept invitation
          </Button>
        </div>

        {showInvite ? (
          <InvitationAcceptance
            onAccept={() => {/* TODO */}}
            loading={false}
          />
        ) : (
          <CreateStoreForm
            onSubmit={(data) => createStore.mutate(data)}
            loading={createStore.isPending}
            error={createStore.error instanceof ApiError ? createStore.error.message : null}
            success={createStore.isSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of your store performance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <StoreSwitcher
                stores={stores ?? []}
                loading={storesLoading}
                onSelect={(id) => selectStore.mutate(id)}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              {capabilities ? (
                <div className="flex flex-wrap gap-2">
                  {capabilities.permissions.map((p) => (
                    <Badge key={p} variant="secondary" size="sm">{p}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm">Loading...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
