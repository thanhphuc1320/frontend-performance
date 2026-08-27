'use client';

import React, { useState } from 'react';

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

  if (success) {
    return (
      <div>
        <p>Store created successfully.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="store-name">Store name</label>
        <input
          id="store-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>
      {(error || validationError) && (
        <div role="alert">{error ?? validationError}</div>
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create store'}
      </button>
    </form>
  );
}
