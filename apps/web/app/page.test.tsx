import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Page from './page';

describe('foundation page', () => {
  it('renders the foundation heading without a network request', () => {
    const markup = renderToStaticMarkup(<Page />);

    expect(markup).toContain('Commerce Control Center foundation');
  });
});
