import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { VerificationState } from './verification-state';

describe('VerificationState', () => {
  it('renders loading state', () => {
    render(React.createElement(VerificationState, { status: 'loading' }));
    expect(screen.getByText(/verifying/i)).toBeInTheDocument();
  });

  it('renders success state', () => {
    render(React.createElement(VerificationState, { status: 'success' }));
    expect(screen.getByText(/email verified/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(React.createElement(VerificationState, { status: 'error', error: 'Token invalid' }));
    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByText('Token invalid')).toBeInTheDocument();
  });

  it('renders expired token state', () => {
    render(React.createElement(VerificationState, { status: 'expired' }));
    expect(screen.getByText(/link expired/i)).toBeInTheDocument();
  });
});
