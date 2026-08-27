import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateStoreForm } from './create-store-form';

describe('CreateStoreForm', () => {
  it('renders name input and submit button', () => {
    render(React.createElement(CreateStoreForm, { onSubmit: vi.fn(), loading: false }));
    expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create store/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(React.createElement(CreateStoreForm, { onSubmit: vi.fn(), loading: true }));
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });

  it('calls onSubmit with name and defaults', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(CreateStoreForm, { onSubmit, loading: false }));
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'My Store' } });
    fireEvent.click(screen.getByRole('button', { name: /create store/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'My Store' }));
  });

  it('displays generic error', () => {
    render(React.createElement(CreateStoreForm, { onSubmit: vi.fn(), loading: false, error: 'Failed' }));
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays success state', () => {
    render(React.createElement(CreateStoreForm, { onSubmit: vi.fn(), loading: false, success: true }));
    expect(screen.getByText(/store created/i)).toBeInTheDocument();
  });

  it('validates required name', async () => {
    const onSubmit = vi.fn();
    render(React.createElement(CreateStoreForm, { onSubmit, loading: false }));
    fireEvent.click(screen.getByRole('button', { name: /create store/i }));
    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
