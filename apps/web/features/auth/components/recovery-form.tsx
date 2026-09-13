'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';

interface RecoveryFormProps {
  onSubmit: (email: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function RecoveryForm({ onSubmit, loading, error, success }: RecoveryFormProps) {
  const [email, setEmail] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit(email);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">
            If an account exists with this email, you will receive a password reset link.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
