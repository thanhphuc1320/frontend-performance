'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';

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

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Accept invitation</CardTitle>
        </div>
        <CardDescription>Enter your invitation token to join a store</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">You have successfully joined the store.</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invitation-token">Invitation token</Label>
              <Input
                id="invitation-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                placeholder="Paste your invitation token here"
              />
            </div>
            {(error || validationError) && (
              <Alert variant="danger">{error ?? validationError}</Alert>
            )}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Accepting...' : 'Accept invitation'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
