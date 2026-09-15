import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CategoryTree } from './category-tree';

const mockCategories = [
  {
    id: 'c1',
    storeId: 's1',
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    sortOrder: 1,
    children: [
      {
        id: 'c1-1',
        storeId: 's1',
        name: 'Phones',
        slug: 'phones',
        parentId: 'c1',
        sortOrder: 1,
        children: [],
      },
      {
        id: 'c1-2',
        storeId: 's1',
        name: 'Laptops',
        slug: 'laptops',
        parentId: 'c1',
        sortOrder: 2,
        children: [],
      },
    ],
  },
  {
    id: 'c2',
    storeId: 's1',
    name: 'Clothing',
    slug: 'clothing',
    parentId: null,
    sortOrder: 2,
    children: [],
  },
];

describe('CategoryTree', () => {
  it('renders tree with categories', () => {
    render(React.createElement(CategoryTree, { categories: mockCategories }));

    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
    expect(screen.getByText('Phones')).toBeInTheDocument();
    expect(screen.getByText('Laptops')).toBeInTheDocument();
  });

  it('renders empty state when no categories', () => {
    render(React.createElement(CategoryTree, { categories: [] }));
    expect(screen.getByTestId('empty-tree')).toHaveTextContent('No categories');
  });

  it('shows sort order for each category', () => {
    render(React.createElement(CategoryTree, { categories: mockCategories }));

    const sortOrders = screen.getAllByText(/^#\d+$/);
    expect(sortOrders.length).toBe(4);
    expect(sortOrders.map((el) => el.textContent)).toContain('#1');
    expect(sortOrders.map((el) => el.textContent)).toContain('#2');
  });

  it('calls onSelect when a category is clicked', () => {
    const handleSelect = vi.fn();
    render(React.createElement(CategoryTree, { categories: mockCategories, onSelect: handleSelect }));

    fireEvent.click(screen.getByTestId('select-c1'));
    expect(handleSelect).toHaveBeenCalledWith('c1');

    fireEvent.click(screen.getByTestId('select-c2'));
    expect(handleSelect).toHaveBeenCalledWith('c2');
  });

  it('highlights selected categories', () => {
    render(
      React.createElement(CategoryTree, {
        categories: mockCategories,
        selectedIds: ['c1'],
      })
    );

    const electronicsNode = screen.getByTestId('category-node-c1');
    expect(electronicsNode).toHaveClass('bg-primary/10');

    const clothingNode = screen.getByTestId('category-node-c2');
    expect(clothingNode).not.toHaveClass('bg-primary/10');
  });

  it('expands and collapses children', () => {
    render(React.createElement(CategoryTree, { categories: mockCategories }));

    // Initially expanded
    expect(screen.getByTestId('children-c1')).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByTestId('toggle-c1'));
    expect(screen.queryByTestId('children-c1')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByTestId('toggle-c1'));
    expect(screen.getByTestId('children-c1')).toBeInTheDocument();
  });

  it('does not show toggle for leaf categories', () => {
    render(React.createElement(CategoryTree, { categories: mockCategories }));

    const clothingToggle = screen.getByTestId('toggle-c2');
    expect(clothingToggle).toHaveClass('opacity-0');
  });

  it('renders recursively for nested children', () => {
    const deepCategories = [
      {
        id: 'root',
        storeId: 's1',
        name: 'Root',
        slug: 'root',
        parentId: null,
        sortOrder: 1,
        children: [
          {
            id: 'child',
            storeId: 's1',
            name: 'Child',
            slug: 'child',
            parentId: 'root',
            sortOrder: 1,
            children: [
              {
                id: 'grandchild',
                storeId: 's1',
                name: 'Grandchild',
                slug: 'grandchild',
                parentId: 'child',
                sortOrder: 1,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    render(React.createElement(CategoryTree, { categories: deepCategories }));

    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.getByText('Grandchild')).toBeInTheDocument();
  });
});
