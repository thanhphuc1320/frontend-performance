import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { VariantEditor } from './variant-editor';
import type { ProductVariant } from '../types';

describe('VariantEditor', () => {
  it('renders empty state', () => {
    render(React.createElement(VariantEditor, { variants: [], onChange: vi.fn() }));
    expect(screen.getByText('No variants yet. Add one to get started.')).toBeInTheDocument();
  });

  it('renders variant list', () => {
    const variants: ProductVariant[] = [
      {
        id: 'v1',
        productId: 'p1',
        sku: 'SKU-001',
        name: 'Small Red',
        priceDelta: 5.0,
        status: 'ACTIVE',
        options: [
          { id: 'o1', variantId: 'v1', optionName: 'Color', optionValue: 'Red' },
        ],
        inventory: { id: 'i1', variantId: 'v1', quantity: 10, reservedQuantity: 0, updatedAt: '' },
      },
    ];
    render(React.createElement(VariantEditor, { variants, onChange: vi.fn() }));
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('Small Red')).toBeInTheDocument();
    expect(screen.getByText('+5.00')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('adds a variant', async () => {
    const onChange = vi.fn();
    render(React.createElement(VariantEditor, { variants: [], onChange }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText(/sku/i), { target: { value: 'SKU-002' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Large Blue' } });
    fireEvent.change(screen.getByLabelText(/price delta/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '20' } });

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const call = onChange.mock.calls[0];
    if (!call) throw new Error('Expected call');
    const newVariants = call[0] as ProductVariant[];
    expect(newVariants).toHaveLength(1);
    const [newVariant] = newVariants;
    if (!newVariant) throw new Error('Expected newVariant');
    expect(newVariant.sku).toBe('SKU-002');
    expect(newVariant.name).toBe('Large Blue');
    expect(newVariant.priceDelta).toBe(10);
    if (!newVariant.inventory) throw new Error('Expected inventory');
    expect(newVariant.inventory.quantity).toBe(20);
  });

  it('edits a variant', async () => {
    const variants: ProductVariant[] = [
      {
        id: 'v1',
        productId: 'p1',
        sku: 'SKU-001',
        name: 'Small Red',
        priceDelta: 5,
        status: 'ACTIVE',
        options: [],
        inventory: { id: 'i1', variantId: 'v1', quantity: 10, reservedQuantity: 0, updatedAt: '' },
      },
    ];
    const onChange = vi.fn();
    render(React.createElement(VariantEditor, { variants, onChange }));

    fireEvent.click(screen.getByTestId('variant-row-v1'));
    fireEvent.change(document.getElementById('variant-sku') as HTMLInputElement, { target: { value: 'SKU-001-UPDATED' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const call = onChange.mock.calls[0];
    if (!call) throw new Error('Expected call');
    const updatedVariants = call[0] as ProductVariant[];
    const [updatedVariant] = updatedVariants;
    if (!updatedVariant) throw new Error('Expected updatedVariant');
    expect(updatedVariant.sku).toBe('SKU-001-UPDATED');
  });

  it('removes a variant', () => {
    const variants: ProductVariant[] = [
      {
        id: 'v1',
        productId: 'p1',
        sku: 'SKU-001',
        name: null,
        priceDelta: 0,
        status: 'ACTIVE',
        options: [],
        inventory: null,
      },
    ];
    const onChange = vi.fn();
    render(React.createElement(VariantEditor, { variants, onChange }));

    fireEvent.click(screen.getByRole('button', { name: /remove variant/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds and removes options', async () => {
    const onChange = vi.fn();
    render(React.createElement(VariantEditor, { variants: [], onChange }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText(/sku/i), { target: { value: 'SKU-003' } });

    // Add option
    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    const optionNameInputs = screen.getAllByPlaceholderText('Option name');
    const optionValueInputs = screen.getAllByPlaceholderText('Option value');
    const optionNameInput = optionNameInputs[0] as HTMLElement;
    const optionValueInput = optionValueInputs[0] as HTMLElement;
    fireEvent.change(optionNameInput, { target: { value: 'Size' } });
    fireEvent.change(optionValueInput, { target: { value: 'Large' } });

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const call = onChange.mock.calls[0];
    if (!call) throw new Error('Expected call');
    const newVariants = call[0] as ProductVariant[];
    const [newVariant] = newVariants;
    if (!newVariant) throw new Error('Expected newVariant');
    expect(newVariant.options).toHaveLength(1);
    const [option] = newVariant.options;
    if (!option) throw new Error('Expected option');
    expect(option.optionName).toBe('Size');
    expect(option.optionValue).toBe('Large');
  });

  it('disables add button when sku is empty', () => {
    render(React.createElement(VariantEditor, { variants: [], onChange: vi.fn() }));
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    const addButton = screen.getByRole('button', { name: /^add$/i });
    expect(addButton).toBeDisabled();
  });
});
