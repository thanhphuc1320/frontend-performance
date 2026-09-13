import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(React.createElement(Button, {}, 'Click me'));
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(React.createElement(Button, { disabled: true }, 'Disabled'));
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading state with spinner', () => {
    render(React.createElement(Button, { loading: true }, 'Loading'));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
