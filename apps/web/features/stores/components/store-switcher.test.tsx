import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StoreSwitcher } from './store-switcher';

describe('StoreSwitcher', () => {
  const stores = [
    { id: 's1', name: 'Store A' },
    { id: 's2', name: 'Store B' },
  ];

  it('renders loading state', () => {
    render(React.createElement(StoreSwitcher, { stores: [], loading: true, onSelect: vi.fn() }));
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(React.createElement(StoreSwitcher, { stores: [], loading: false, onSelect: vi.fn() }));
    expect(screen.getByText(/no stores/i)).toBeInTheDocument();
  });

  it('renders store list and calls onSelect', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(StoreSwitcher, { stores, loading: false, onSelect }));
    expect(screen.getByText('Store A')).toBeInTheDocument();
    expect(screen.getByText('Store B')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Store B'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('s2'));
  });

  it('displays error state', () => {
    render(React.createElement(StoreSwitcher, { stores: [], loading: false, onSelect: vi.fn(), error: 'Failed to load' }));
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});
