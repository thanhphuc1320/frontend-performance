'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';

interface RegisterFormProps {
  onSubmit: (data: { email: string; password: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function RegisterForm({ onSubmit, loading, error, success }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit({ email, password });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">
            Registration successful! Please check your email to verify your account.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-text-muted">Password must be at least 12 characters</p>
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
