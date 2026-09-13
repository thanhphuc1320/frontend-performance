'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import { Store } from 'lucide-react';

interface CreateStoreFormProps {
  onSubmit: (data: { name: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function CreateStoreForm({ onSubmit, loading, error, success }: CreateStoreFormProps) {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    void onSubmit({ name });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <CardTitle>Create your first store</CardTitle>
        </div>
        <CardDescription>Set up your store to start managing products and orders</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">Store created successfully!</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input
                id="store-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                placeholder="My Store"
              />
            </div>
            {(error || validationError) && (
              <Alert variant="danger">{error ?? validationError}</Alert>
            )}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Creating...' : 'Create store'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
