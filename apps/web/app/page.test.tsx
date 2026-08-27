import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from './page';

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: {} }),
    } as Response));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the commerce control center heading', async () => {
    render(React.createElement(Page), { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/commerce control center/i)).toBeInTheDocument());
  });
});
