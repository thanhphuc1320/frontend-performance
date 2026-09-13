import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { InvitationAcceptance } from './invitation-acceptance';

describe('InvitationAcceptance', () => {
  it('renders token input and submit button', () => {
    render(React.createElement(InvitationAcceptance, { onAccept: vi.fn(), loading: false }));
    expect(screen.getByLabelText(/invitation token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(React.createElement(InvitationAcceptance, { onAccept: vi.fn(), loading: true }));
    expect(screen.getByRole('button', { name: /accepting/i })).toBeDisabled();
  });

  it('calls onAccept with token', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(InvitationAcceptance, { onAccept, loading: false }));
    fireEvent.change(screen.getByLabelText(/invitation token/i), { target: { value: 'tok123' } });
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }));
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith('tok123'));
  });

  it('displays generic error', () => {
    render(React.createElement(InvitationAcceptance, { onAccept: vi.fn(), loading: false, error: 'Invalid token' }));
    expect(screen.getByText('Invalid token')).toBeInTheDocument();
  });

  it('displays success state', () => {
    render(React.createElement(InvitationAcceptance, { onAccept: vi.fn(), loading: false, success: true }));
    expect(screen.getByText(/joined/i)).toBeInTheDocument();
  });

  it('validates required token', async () => {
    const onAccept = vi.fn();
    render(React.createElement(InvitationAcceptance, { onAccept, loading: false }));
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }));
    await waitFor(() => expect(screen.getByText(/token is required/i)).toBeInTheDocument());
    expect(onAccept).not.toHaveBeenCalled();
  });
});
