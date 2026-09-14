'use client';

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import type { Category } from '../types';

interface CategoryTreeProps {
  categories: Category[];
  onSelect?: (id: string) => void;
  selectedIds?: string[];
}

interface CategoryTreeNodeProps {
  category: Category;
  onSelect?: (id: string) => void;
  selectedIds: string[];
  level: number;
}

function CategoryTreeNode({ category, onSelect, selectedIds, level }: CategoryTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedIds.includes(category.id);

  const handleToggle = useCallback(() => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const handleSelect = useCallback(() => {
    onSelect?.(category.id);
  }, [onSelect, category.id]);

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        data-testid={`category-node-${category.id}`}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-opacity ${
            hasChildren ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          data-testid={`toggle-${category.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-muted" />
          )}
        </button>

        <button
          type="button"
          onClick={handleSelect}
          className="flex flex-1 items-center gap-2 text-left"
          data-testid={`select-${category.id}`}
        >
          <Folder className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="font-medium">{category.name}</span>
          <span className="text-xs text-text-muted">#{category.sortOrder}</span>
        </button>
      </div>

      {hasChildren && expanded && (
        <div data-testid={`children-${category.id}`}>
          {category.children!.map((child) => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              onSelect={onSelect}
              selectedIds={selectedIds}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ categories, onSelect, selectedIds = [] }: CategoryTreeProps) {
  if (!categories || categories.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-muted" data-testid="empty-tree">
        No categories
      </p>
    );
  }

  return (
    <div className="space-y-0.5" role="tree" aria-label="Category tree">
      {categories.map((category) => (
        <CategoryTreeNode
          key={category.id}
          category={category}
          onSelect={onSelect}
          selectedIds={selectedIds}
          level={0}
        />
      ))}
    </div>
  );
}
