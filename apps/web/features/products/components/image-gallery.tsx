'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import type { ProductImage } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface ImageGalleryProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function ImageGallery({ images, onChange }: ImageGalleryProps) {
  const [editingImage, setEditingImage] = useState<ProductImage | null>(null);
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');

  function handleSave() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    if (editingImage) {
      const updated: ProductImage = {
        ...editingImage,
        url: trimmedUrl,
        altText: altText.trim() || null,
      };
      onChange(images.map((img) => (img.id === updated.id ? updated : img)));
    } else {
      const newImage: ProductImage = {
        id: generateId(),
        productId: '',
        url: trimmedUrl,
        altText: altText.trim() || null,
        sortOrder: images.length,
      };
      onChange([...images, newImage]);
    }

    setEditingImage(null);
    setUrl('');
    setAltText('');
  }

  function handleRemove(id: string) {
    onChange(images.filter((img) => img.id !== id).map((img, index) => ({ ...img, sortOrder: index })));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[index - 1]!;
    newImages[index - 1] = temp!;
    onChange(newImages.map((img, i) => ({ ...img, sortOrder: i })));
  }

  function moveDown(index: number) {
    if (index === images.length - 1) return;
    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[index + 1]!;
    newImages[index + 1] = temp!;
    onChange(newImages.map((img, i) => ({ ...img, sortOrder: i })));
  }

  const isEditing = editingImage !== null || url !== '';

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-border bg-white p-4">
        <div className="space-y-2">
          <Label htmlFor="image-url">Image URL</Label>
          <Input
            id="image-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="image-alt">Alt text</Label>
          <Input
            id="image-alt"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Descriptive alt text"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!url.trim()}
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            {editingImage ? 'Update image' : 'Add image'}
          </Button>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingImage(null);
                setUrl('');
                setAltText('');
              }}
              className="ml-2"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-text-muted">No images yet. Add one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="group relative rounded-lg border border-border bg-white overflow-hidden"
              data-testid={`image-card-${image.id}`}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.altText ?? ''}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-sm text-text-muted">No preview</span>
                )}
              </div>
              <div className="p-3 space-y-2">
                <Input
                  value={image.url}
                  onChange={(e) => {
                    const updated = images.map((img) =>
                      img.id === image.id ? { ...img, url: e.target.value } : img
                    );
                    onChange(updated);
                  }}
                  placeholder="Image URL"
                  className="text-sm"
                />
                <Input
                  value={image.altText ?? ''}
                  onChange={(e) => {
                    const updated = images.map((img) =>
                      img.id === image.id ? { ...img, altText: e.target.value || null } : img
                    );
                    onChange(updated);
                  }}
                  placeholder="Alt text"
                  className="text-sm"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border p-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveDown(index)}
                    disabled={index === images.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleRemove(image.id)}
                  aria-label={`Remove image ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
