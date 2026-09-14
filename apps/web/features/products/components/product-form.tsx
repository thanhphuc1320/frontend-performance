'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent } from '../../../components/ui/card';
import { FormError } from '../../../components/ui/form-error';
import { VariantEditor } from './variant-editor';
import { ImageGallery } from './image-gallery';
import {
  useCreateProduct,
  useUpdateProduct,
  useCategories,
  useTags,
  useCreateTag,
} from '../queries';
import type { ProductDetail, ProductVariant, ProductImage, Category, ProductTag } from '../types';
import { X, Plus } from 'lucide-react';

type Tab = 'general' | 'variants' | 'images' | 'categories' | 'tags';

interface ProductFormProps {
  storeId: string;
  product?: ProductDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProductForm({ storeId, product, onSuccess, onCancel }: ProductFormProps) {
  const isEditMode = !!product;
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // General fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');

  // Sub-entities
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Tag creation
  const [newTagName, setNewTagName] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categoriesData } = useCategories(storeId);
  const { data: tagsData } = useTags(storeId);
  const createTag = useCreateTag();

  // Pre-fill in edit mode
  useEffect(() => {
    if (product) {
      setName(product.product.name);
      setSlug(product.product.slug);
      setDescription(product.product.description ?? '');
      setBasePrice(String(product.product.basePrice));
      setStatus(product.product.status);
      setVariants(product.variants);
      setImages(product.images);
      setSelectedCategoryIds(product.categories.map((c: Category) => c.id));
      setSelectedTagIds(product.tags.map((t: ProductTag) => t.id));
    }
  }, [product]);

  const isSubmitting = createProduct.isPending || updateProduct.isPending;
  const mutationError = createProduct.error || updateProduct.error;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!slug.trim()) {
      newErrors.slug = 'Slug is required';
    }
    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.basePrice = 'Base price must be a non-negative number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      setActiveTab('general');
      return;
    }

    const data = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      basePrice: parseFloat(basePrice),
      status,
    };

    if (isEditMode && product) {
      updateProduct.mutate(
        { storeId, productId: product.product.id, data },
        {
          onSuccess: () => {
            onSuccess?.();
          },
        }
      );
    } else {
      createProduct.mutate(
        { storeId, data },
        {
          onSuccess: () => {
            onSuccess?.();
          },
        }
      );
    }
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    createTag.mutate(
      { storeId, data: { name: trimmed } },
      {
        onSuccess: (newTag) => {
          setSelectedTagIds((prev) => [...prev, newTag.id]);
          setNewTagName('');
        },
      }
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'variants', label: 'Variants' },
    { key: 'images', label: 'Images' },
    { key: 'categories', label: 'Categories' },
    { key: 'tags', label: 'Tags' },
  ];

  function renderCategories(categories: Category[], level = 0): React.ReactNode {
    return categories.map((category) => (
      <div key={category.id} className={level > 0 ? 'ml-4' : ''}>
        <label className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-gray-50 rounded px-2">
          <input
            type="checkbox"
            checked={selectedCategoryIds.includes(category.id)}
            onChange={() => toggleCategory(category.id)}
            className="rounded border-border"
          />
          <span>{category.name}</span>
        </label>
        {category.children && category.children.length > 0 && renderCategories(category.children, level + 1)}
      </div>
    ));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-b border-border">
        <nav className="flex gap-1" aria-label="Product form tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
              aria-selected={activeTab === tab.key}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'general' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="product-name" required>
                Name
              </Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                placeholder="Product name"
              />
              {errors.name && <FormError>{errors.name}</FormError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-slug" required>
                Slug
              </Label>
              <Input
                id="product-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                error={!!errors.slug}
                placeholder="product-slug"
              />
              {errors.slug && <FormError>{errors.slug}</FormError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Product description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-price" required>
                Base Price
              </Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                error={!!errors.basePrice}
                placeholder="0.00"
              />
              {errors.basePrice && <FormError>{errors.basePrice}</FormError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-status">Status</Label>
              <select
                id="product-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'variants' && (
        <Card>
          <CardContent className="pt-6">
            <VariantEditor variants={variants} onChange={setVariants} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'images' && (
        <Card>
          <CardContent className="pt-6">
            <ImageGallery images={images} onChange={setImages} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'categories' && (
        <Card>
          <CardContent className="pt-6">
            {categoriesData && categoriesData.length > 0 ? (
              <div className="space-y-1">{renderCategories(categoriesData)}</div>
            ) : (
              <p className="text-sm text-text-muted">No categories available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'tags' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTag.isPending}
                size="sm"
              >
                <Plus className="mr-1 h-4 w-4" />
                Create
              </Button>
            </div>

            {tagsData && tagsData.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tagsData.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                      {isSelected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No tags available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {mutationError && (
        <FormError>
          {mutationError instanceof Error ? mutationError.message : 'An error occurred'}
        </FormError>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          {isEditMode ? 'Update product' : 'Create product'}
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
