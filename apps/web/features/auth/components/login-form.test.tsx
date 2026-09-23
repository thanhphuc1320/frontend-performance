import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders email, password inputs and submit button', () => {
    render(React.createElement(LoginForm, { onSubmit: vi.fn(), loading: false }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(React.createElement(LoginForm, { onSubmit: vi.fn(), loading: true }));
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('calls onSubmit with credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(LoginForm, { onSubmit, loading: false }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'Password1!', rememberMe: false }));
  });

  it('displays generic error', () => {
    render(React.createElement(LoginForm, { onSubmit: vi.fn(), loading: false, error: 'Login failed' }));
    expect(screen.getByText('Login failed')).toBeInTheDocument();
  });

  it('displays 401 error without enumeration', () => {
    render(React.createElement(LoginForm, { onSubmit: vi.fn(), loading: false, errorCode: 'UNAUTHENTICATED' }));
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const onSubmit = vi.fn();
    render(React.createElement(LoginForm, { onSubmit, loading: false }));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/email is required/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
