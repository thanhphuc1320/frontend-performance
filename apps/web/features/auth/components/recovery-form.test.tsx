import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RecoveryForm } from './recovery-form';

describe('RecoveryForm', () => {
  it('renders email input and submit button', () => {
    render(React.createElement(RecoveryForm, { onSubmit: vi.fn(), loading: false }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(React.createElement(RecoveryForm, { onSubmit: vi.fn(), loading: true }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('calls onSubmit with email', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(RecoveryForm, { onSubmit, loading: false }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.com'));
  });

  it('displays generic error', () => {
    render(React.createElement(RecoveryForm, { onSubmit: vi.fn(), loading: false, error: 'Failed' }));
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays success state', () => {
    render(React.createElement(RecoveryForm, { onSubmit: vi.fn(), loading: false, success: true }));
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it('validates required email', async () => {
    const onSubmit = vi.fn();
    render(React.createElement(RecoveryForm, { onSubmit, loading: false }));
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => expect(screen.getByText(/email is required/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
