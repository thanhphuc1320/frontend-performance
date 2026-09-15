import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ImageGallery } from './image-gallery';
import type { ProductImage } from '../types';

describe('ImageGallery', () => {
  it('renders empty state', () => {
    render(React.createElement(ImageGallery, { images: [], onChange: vi.fn() }));
    expect(screen.getByText('No images yet. Add one above.')).toBeInTheDocument();
  });

  it('renders images', () => {
    const images: ProductImage[] = [
      {
        id: 'img1',
        productId: 'p1',
        url: 'https://example.com/1.jpg',
        altText: 'Image 1',
        sortOrder: 0,
      },
      {
        id: 'img2',
        productId: 'p1',
        url: 'https://example.com/2.jpg',
        altText: null,
        sortOrder: 1,
      },
    ];
    render(React.createElement(ImageGallery, { images, onChange: vi.fn() }));
    expect(screen.getByTestId('image-card-img1')).toBeInTheDocument();
    expect(screen.getByTestId('image-card-img2')).toBeInTheDocument();
  });

  it('adds an image', async () => {
    const onChange = vi.fn();
    render(React.createElement(ImageGallery, { images: [], onChange }));

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.com/new.jpg' },
    });
    fireEvent.change(screen.getByLabelText(/alt text/i), {
      target: { value: 'New image' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add image/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const call = onChange.mock.calls[0];
    if (!call) throw new Error('Expected call');
    const newImages = call[0] as ProductImage[];
    expect(newImages).toHaveLength(1);
    const [newImage] = newImages;
    if (!newImage) throw new Error('Expected newImage to be defined');
    expect(newImage.url).toBe('https://example.com/new.jpg');
    expect(newImage.altText).toBe('New image');
  });

  it('removes an image', () => {
    const images: ProductImage[] = [
      {
        id: 'img1',
        productId: 'p1',
        url: 'https://example.com/1.jpg',
        altText: 'Image 1',
        sortOrder: 0,
      },
    ];
    const onChange = vi.fn();
    render(React.createElement(ImageGallery, { images, onChange }));

    fireEvent.click(screen.getByRole('button', { name: /remove image/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('reorders images with up/down buttons', () => {
    const images: ProductImage[] = [
      {
        id: 'img1',
        productId: 'p1',
        url: 'https://example.com/1.jpg',
        altText: 'Image 1',
        sortOrder: 0,
      },
      {
        id: 'img2',
        productId: 'p1',
        url: 'https://example.com/2.jpg',
        altText: 'Image 2',
        sortOrder: 1,
      },
    ];
    const onChange = vi.fn();
    render(React.createElement(ImageGallery, { images, onChange }));

    const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
    const moveDownButton = moveDownButtons[0] as HTMLElement;
    fireEvent.click(moveDownButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const call = onChange.mock.calls[0];
    if (!call) throw new Error('Expected call');
    const reordered = call[0] as ProductImage[];
    const [first, second] = reordered;
    if (!first || !second) throw new Error('Expected reordered images');
    expect(first.id).toBe('img2');
    expect(second.id).toBe('img1');
  });

  it('disables add image button when url is empty', () => {
    render(React.createElement(ImageGallery, { images: [], onChange: vi.fn() }));
    const addButton = screen.getByRole('button', { name: /add image/i });
    expect(addButton).toBeDisabled();
  });
});
