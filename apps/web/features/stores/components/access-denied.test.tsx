import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AccessDenied } from './access-denied';

describe('AccessDenied', () => {
  it('renders access denied message', () => {
    render(React.createElement(AccessDenied));
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('renders optional detail', () => {
    render(React.createElement(AccessDenied, { detail: 'You do not have permission to view this store.' }));
    expect(screen.getByText('You do not have permission to view this store.')).toBeInTheDocument();
  });
});
