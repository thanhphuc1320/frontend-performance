'use client';

import React from 'react';
import type { Store } from '../api';

interface StoreSwitcherProps {
  stores: Store[];
  loading?: boolean;
  error?: string | null;
  onSelect: (storeId: string) => void | Promise<void>;
}

export function StoreSwitcher({ stores, loading, error, onSelect }: StoreSwitcherProps) {
  if (loading) {
    return <div>Loading stores...</div>;
  }

  if (error) {
    return <div role="alert">{error}</div>;
  }

  if (stores.length === 0) {
    return <div>No stores available.</div>;
  }

  return (
    <ul>
      {stores.map((store) => (
        <li key={store.id}>
          <button type="button" onClick={() => void onSelect(store.id)}>
            {store.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
