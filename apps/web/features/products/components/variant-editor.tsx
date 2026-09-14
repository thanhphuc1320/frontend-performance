'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';
import type { ProductVariant, VariantOption } from '../../types';
import { Plus, Trash2, X } from 'lucide-react';

interface VariantEditorProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function VariantEditor({ variants, onChange }: VariantEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  const [formData, setFormData] = useState<{
    sku: string;
    name: string;
    priceDelta: string;
    quantity: string;
    options: { optionName: string; optionValue: string }[];
  }>({
    sku: '',
    name: '',
    priceDelta: '0',
    quantity: '0',
    options: [],
  });

  function resetForm() {
    setFormData({
      sku: '',
      name: '',
      priceDelta: '0',
      quantity: '0',
      options: [],
    });
  }

  function openAdd() {
    resetForm();
    setIsAdding(true);
    setEditingVariant(null);
  }

  function openEdit(variant: ProductVariant) {
    setEditingVariant(variant);
    setFormData({
      sku: variant.sku,
      name: variant.name ?? '',
      priceDelta: String(variant.priceDelta),
      quantity: String(variant.inventory?.quantity ?? 0),
      options: variant.options.map((o) => ({ optionName: o.optionName, optionValue: o.optionValue })),
    });
    setIsAdding(true);
  }

  function closeModal() {
    setIsAdding(false);
    setEditingVariant(null);
    resetForm();
  }

  function handleSave() {
    const priceDelta = parseFloat(formData.priceDelta) || 0;
    const quantity = parseInt(formData.quantity, 10) || 0;

    const options: VariantOption[] = formData.options
      .filter((o) => o.optionName.trim() && o.optionValue.trim())
      .map((o) => ({
        id: generateId(),
        variantId: editingVariant?.id ?? generateId(),
        optionName: o.optionName.trim(),
        optionValue: o.optionValue.trim(),
      }));

    if (editingVariant) {
      const updated: ProductVariant = {
        ...editingVariant,
        sku: formData.sku.trim(),
        name: formData.name.trim() || null,
        priceDelta,
        options,
        inventory: {
          id: editingVariant.inventory?.id ?? generateId(),
          variantId: editingVariant.id,
          quantity,
          reservedQuantity: editingVariant.inventory?.reservedQuantity ?? 0,
          updatedAt: new Date().toISOString(),
        },
      };
      onChange(variants.map((v) => (v.id === updated.id ? updated : v)));
    } else {
      const id = generateId();
      const newVariant: ProductVariant = {
        id,
        productId: '',
        sku: formData.sku.trim(),
        name: formData.name.trim() || null,
        priceDelta,
        status: 'ACTIVE',
        options: options.map((o) => ({ ...o, variantId: id })),
        inventory: {
          id: generateId(),
          variantId: id,
          quantity,
          reservedQuantity: 0,
          updatedAt: new Date().toISOString(),
        },
      };
      onChange([...variants, newVariant]);
    }

    closeModal();
  }

  function handleRemove(id: string) {
    onChange(variants.filter((v) => v.id !== id));
  }

  function addOption() {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, { optionName: '', optionValue: '' }],
    }));
  }

  function removeOption(index: number) {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }

  function updateOption(index: number, field: 'optionName' | 'optionValue', value: string) {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }));
  }

  const isValid = formData.sku.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openAdd} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add variant
        </Button>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-text-muted">No variants yet. Add one to get started.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price Delta</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => (
              <TableRow
                key={variant.id}
                className="cursor-pointer"
                onClick={() => openEdit(variant)}
                data-testid={`variant-row-${variant.id}`}
              >
                <TableCell>{variant.sku}</TableCell>
                <TableCell>{variant.name ?? '—'}</TableCell>
                <TableCell>
                  {variant.priceDelta > 0 ? '+' : ''}
                  {variant.priceDelta.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {variant.options.map((o) => (
                      <Badge key={o.id} variant="secondary" size="sm">
                        {o.optionName}: {o.optionValue}
                      </Badge>
                    ))}
                    {variant.options.length === 0 && '—'}
                  </div>
                </TableCell>
                <TableCell>{variant.inventory?.quantity ?? 0}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(variant.id);
                    }}
                    aria-label={`Remove variant ${variant.sku}`}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal
        open={isAdding}
        onClose={closeModal}
        title={editingVariant ? 'Edit variant' : 'Add variant'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!isValid}>
              {editingVariant ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variant-sku" required>
              SKU
            </Label>
            <Input
              id="variant-sku"
              value={formData.sku}
              onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder="SKU-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant-name">Name</Label>
            <Input
              id="variant-name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Variant name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="variant-price">Price Delta</Label>
              <Input
                id="variant-price"
                type="number"
                step="0.01"
                value={formData.priceDelta}
                onChange={(e) => setFormData((prev) => ({ ...prev, priceDelta: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant-quantity">Quantity</Label>
              <Input
                id="variant-quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Options</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                <Plus className="mr-1 h-3 w-3" />
                Add option
              </Button>
            </div>
            {formData.options.length === 0 && (
              <p className="text-sm text-text-muted">No options added.</p>
            )}
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Option name"
                  value={option.optionName}
                  onChange={(e) => updateOption(index, 'optionName', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Option value"
                  value={option.optionValue}
                  onChange={(e) => updateOption(index, 'optionValue', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeOption(index)}
                  aria-label="Remove option"
                >
                  <X className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
