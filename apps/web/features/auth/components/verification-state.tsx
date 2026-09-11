'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface VerificationStateProps {
  status: 'loading' | 'success' | 'error' | 'expired';
  error?: string | null;
}

export function VerificationState({ status, error }: VerificationStateProps) {
  const router = useRouter();
  const states = {
    loading: {
      icon: Loader2,
      title: 'Verifying your email...',
      description: 'Please wait while we verify your email address.',
      iconClass: 'text-primary animate-spin',
    },
    success: {
      icon: CheckCircle2,
      title: 'Email verified!',
      description: 'Your email has been successfully verified. You can now sign in.',
      iconClass: 'text-success',
    },
    error: {
      icon: AlertCircle,
      title: 'Verification failed',
      description: error || 'The verification link is invalid or has expired.',
      iconClass: 'text-danger',
    },
    expired: {
      icon: Clock,
      title: 'Link expired',
      description: 'This verification link has expired. Please request a new one.',
      iconClass: 'text-warning',
    },
  };

  const state = states[status];
  const Icon = state.icon;

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <Icon className={`h-16 w-16 mb-4 ${state.iconClass}`} />
        <h2 className="text-xl font-semibold text-text-primary mb-2">{state.title}</h2>
        <p className="text-text-secondary mb-6">{state.description}</p>
        {status === 'success' && (
          <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
        )}
        {(status === 'error' || status === 'expired') && (
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
