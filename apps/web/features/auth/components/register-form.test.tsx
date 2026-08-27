import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('renders email and password inputs and submit button', () => {
    render(React.createElement(RegisterForm, { onSubmit: vi.fn(), loading: false }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(React.createElement(RegisterForm, { onSubmit: vi.fn(), loading: true }));
    expect(screen.getByRole('button', { name: /registering/i })).toBeDisabled();
  });

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(RegisterForm, { onSubmit, loading: false }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'Password1!' }));
  });

  it('displays generic error', () => {
    render(React.createElement(RegisterForm, { onSubmit: vi.fn(), loading: false, error: 'Something went wrong' }));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays success state', () => {
    render(React.createElement(RegisterForm, { onSubmit: vi.fn(), loading: false, success: true }));
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const onSubmit = vi.fn();
    render(React.createElement(RegisterForm, { onSubmit, loading: false }));
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => expect(screen.getByText(/email is required/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
