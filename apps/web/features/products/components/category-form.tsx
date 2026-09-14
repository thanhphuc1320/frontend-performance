'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent } from '../../../components/ui/card';
import { FormError } from '../../../components/ui/form-error';
import { useCreateCategory, useUpdateCategory } from '../queries';
import type { Category } from '../types';

interface CategoryFormProps {
  storeId: string;
  category?: Category;
  parentCategories: Category[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

function flattenCategories(categories: Category[]): Category[] {
  const result: Category[] = [];
  for (const cat of categories) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children));
    }
  }
  return result;
}

function isUrlSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function CategoryForm({ storeId, category, parentCategories, onSuccess, onCancel }: CategoryFormProps) {
  const isEditMode = !!category;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('0');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isSubmitting = createCategory.isPending || updateCategory.isPending;
  const mutationError = createCategory.error || updateCategory.error;

  // Pre-fill in edit mode
  useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setParentId(category.parentId ?? '');
      setSortOrder(String(category.sortOrder));
    }
  }, [category]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (!trimmedName) {
      newErrors.name = 'Name is required';
    }

    if (!trimmedSlug) {
      newErrors.slug = 'Slug is required';
    } else if (!isUrlSafeSlug(trimmedSlug)) {
      newErrors.slug = 'Slug must be URL-safe (lowercase letters, numbers, hyphens only)';
    }

    const sortOrderNum = parseInt(sortOrder, 10);
    if (isNaN(sortOrderNum)) {
      newErrors.sortOrder = 'Sort order must be a number';
    }

    // Prevent selecting self or own descendants as parent in edit mode
    if (isEditMode && category && parentId === category.id) {
      newErrors.parentId = 'A category cannot be its own parent';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      return;
    }

    const data = {
      name: name.trim(),
      slug: slug.trim(),
      parentId: parentId || null,
      sortOrder: parseInt(sortOrder, 10),
    };

    if (isEditMode && category) {
      updateCategory.mutate(
        { storeId, categoryId: category.id, data },
        {
          onSuccess: () => {
            onSuccess?.();
          },
        }
      );
    } else {
      createCategory.mutate(
        { storeId, data },
        {
          onSuccess: () => {
            onSuccess?.();
          },
        }
      );
    }
  }

  const flatParents = flattenCategories(parentCategories);
  // In edit mode, exclude the current category and its descendants from parent options
  const availableParents = isEditMode && category
    ? flatParents.filter((c) => c.id !== category.id)
    : flatParents;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="category-name" required>
              Name
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              placeholder="Category name"
            />
            {errors.name && <FormError>{errors.name}</FormError>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-slug" required>
              Slug
            </Label>
            <Input
              id="category-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              error={!!errors.slug}
              placeholder="category-slug"
            />
            {errors.slug && <FormError>{errors.slug}</FormError>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-parent">Parent Category</Label>
            <select
              id="category-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              <option value="">None (root category)</option>
              {availableParents.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.parentId && <FormError>{errors.parentId}</FormError>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-sort-order">Sort Order</Label>
            <Input
              id="category-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              error={!!errors.sortOrder}
              placeholder="0"
            />
            {errors.sortOrder && <FormError>{errors.sortOrder}</FormError>}
          </div>
        </CardContent>
      </Card>

      {mutationError && (
        <FormError>
          {mutationError instanceof Error ? mutationError.message : 'An error occurred'}
        </FormError>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          {isEditMode ? 'Update category' : 'Create category'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
