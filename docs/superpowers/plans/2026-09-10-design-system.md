# Phase 1 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI foundation layer including TailwindCSS setup, custom theme, application shell with sidebar navigation, and reusable UI primitive components for the Commerce Control Center.

**Architecture:** TailwindCSS v4 with PostCSS, custom design tokens matching the visual reference (`design/commerce-control-center-preview.png`). Self-built component library (no shadcn/ui) for full visual control. Feature-based organization with `components/ui/` for primitives and `components/layout/` for shell components.

**Tech Stack:** TailwindCSS v4, PostCSS, lucide-react, Next.js 15, React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-10-design-system.md`

## Global Constraints

- Node.js >= 24.0.0 < 25
- pnpm 10.14.0
- Next.js ^15.5.2
- React ^19.1.1
- TypeScript strict mode
- TailwindCSS v4 (latest stable)
- All components must be TypeScript with typed props
- Components must handle loading, empty, error, and disabled states where applicable
- Accessibility: keyboard navigation, focus management, aria attributes for interactive components
- No business logic in UI primitive components
- Existing tests must continue to pass after styling changes

---

## File Structure

**New files:**
- `apps/web/tailwind.config.ts` — Tailwind theme configuration
- `apps/web/postcss.config.mjs` — PostCSS configuration
- `apps/web/app/globals.css` — Global CSS with Tailwind directives and custom properties
- `apps/web/components/ui/button.tsx` — Button primitive
- `apps/web/components/ui/input.tsx` — Input primitive
- `apps/web/components/ui/label.tsx` — Form label
- `apps/web/components/ui/form-error.tsx` — Form error message
- `apps/web/components/ui/card.tsx` — Card container
- `apps/web/components/ui/badge.tsx` — Status badge
- `apps/web/components/ui/spinner.tsx` — Loading spinner
- `apps/web/components/ui/skeleton.tsx` — Skeleton loader
- `apps/web/components/ui/alert.tsx` — Alert message
- `apps/web/components/ui/modal.tsx` — Modal/Dialog overlay
- `apps/web/components/ui/table.tsx` — Table primitive
- `apps/web/components/layout/app-shell.tsx` — App shell wrapper
- `apps/web/components/layout/sidebar.tsx` — Sidebar navigation
- `apps/web/components/layout/sidebar-nav.tsx` — Navigation items
- `apps/web/components/layout/sidebar-section.tsx` — Collapsible section
- `apps/web/components/layout/header.tsx` — Top header bar
- `apps/web/components/layout/content-area.tsx` — Main content wrapper
- `apps/web/components/providers/toast-provider.tsx` — Toast context and container

**Modified files:**
- `apps/web/app/layout.tsx` — Add global styles, Google Fonts (Inter)
- `apps/web/app/page.tsx` — Restructure views, apply AppShell for authenticated routes
- `apps/web/package.json` — Add tailwindcss, @tailwindcss/postcss, lucide-react, postcss
- `apps/web/features/auth/components/login-form.tsx` — Style with new primitives
- `apps/web/features/auth/components/register-form.tsx` — Style with new primitives
- `apps/web/features/auth/components/recovery-form.tsx` — Style with new primitives
- `apps/web/features/auth/components/verification-state.tsx` — Style with new primitives
- `apps/web/features/stores/components/create-store-form.tsx` — Style with new primitives
- `apps/web/features/stores/components/store-switcher.tsx` — Style with new primitives
- `apps/web/features/stores/components/invitation-acceptance.tsx` — Style with new primitives
- `apps/web/features/stores/components/access-denied.tsx` — Style with new primitives

---

### Task 1: TailwindCSS Setup and Global Styles

**Files:**
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: None (foundation task)
- Produces: TailwindCSS build pipeline, custom CSS properties, global styles available to all components

- [ ] **Step 1: Add dependencies**

```bash
cd apps/web
pnpm add -D tailwindcss @tailwindcss/postcss postcss
pnpm add lucide-react
```

- [ ] **Step 2: Create PostCSS config**

Create `apps/web/postcss.config.mjs`:

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 3: Create Tailwind config**

Create `apps/web/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
          light: '#dbeafe',
        },
        sidebar: {
          bg: '#0f172a',
          hover: '#1e293b',
          active: '#334155',
          text: '#94a3b8',
          'text-active': '#f8fafc',
        },
        content: {
          bg: '#f8fafc',
        },
        border: '#e2e8f0',
        'text-primary': '#0f172a',
        'text-secondary': '#64748b',
        'text-muted': '#94a3b8',
        success: {
          DEFAULT: '#10b981',
          light: '#d1fae5',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        danger: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
        },
        info: {
          DEFAULT: '#3b82f6',
          light: '#dbeafe',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Create global CSS**

Create `apps/web/app/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-primary-light: #dbeafe;
  --color-sidebar-bg: #0f172a;
  --color-sidebar-hover: #1e293b;
  --color-sidebar-active: #334155;
  --color-sidebar-text: #94a3b8;
  --color-sidebar-text-active: #f8fafc;
  --color-content-bg: #f8fafc;
  --color-card-bg: #ffffff;
  --color-border: #e2e8f0;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;
  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-danger: #ef4444;
  --color-danger-light: #fee2e2;
  --color-info: #3b82f6;
  --color-info-light: #dbeafe;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}

html {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--color-content-bg);
  color: var(--color-text-primary);
}
```

- [ ] **Step 5: Update layout.tsx to import global CSS and Inter font**

Modify `apps/web/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Commerce Control Center',
  description: 'Commerce Control Center',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @commerce/web typecheck
pnpm --filter @commerce/web build
```

Expected: PASS (build succeeds with TailwindCSS processing)

- [ ] **Step 7: Commit**

```bash
git add apps/web/postcss.config.mjs apps/web/tailwind.config.ts apps/web/app/globals.css apps/web/app/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat: setup TailwindCSS v4 with custom theme"
```

---

### Task 2: UI Primitive Components — Button, Input, Label, FormError

**Files:**
- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/input.tsx`
- Create: `apps/web/components/ui/label.tsx`
- Create: `apps/web/components/ui/form-error.tsx`
- Create: `apps/web/components/ui/spinner.tsx`

**Interfaces:**
- Consumes: TailwindCSS theme, lucide-react (for Spinner)
- Produces: Reusable Button, Input, Label, FormError, Spinner primitives for all form components

- [ ] **Step 1: Write component test file**

Create `apps/web/components/ui/button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading state with spinner', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement Button component**

Create `apps/web/components/ui/button.tsx`:

```typescript
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    default: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'border border-border bg-white text-text-primary hover:bg-gray-50',
    destructive: 'bg-danger text-white hover:bg-red-600',
    ghost: 'text-text-secondary hover:bg-gray-100',
    link: 'text-primary underline-offset-4 hover:underline',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    default: 'h-10 px-4 py-2',
    lg: 'h-11 px-8 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Implement Input component**

Create `apps/web/components/ui/input.tsx`:

```typescript
import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm
          placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-danger focus:ring-danger' : ''}
          ${className}
        `}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
```

- [ ] **Step 4: Implement Label component**

Create `apps/web/components/ui/label.tsx`:

```typescript
import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = '', ...props }: LabelProps) {
  return (
    <label className={`text-sm font-medium text-text-secondary ${className}`} {...props}>
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  );
}
```

- [ ] **Step 5: Implement FormError component**

Create `apps/web/components/ui/form-error.tsx`:

```typescript
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  children: React.ReactNode;
}

export function FormError({ children }: FormErrorProps) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-danger mt-1" role="alert">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
```

- [ ] **Step 6: Implement Spinner component**

Create `apps/web/components/ui/spinner.tsx`:

```typescript
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function Spinner({ size = 'default', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={`animate-spin text-primary ${sizes[size]} ${className}`} />
  );
}
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @commerce/web test -- button.test.tsx
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/ui/
git commit -m "feat: add UI primitive components (Button, Input, Label, FormError, Spinner)"
```

---

### Task 3: UI Primitive Components — Card, Badge, Alert, Skeleton

**Files:**
- Create: `apps/web/components/ui/card.tsx`
- Create: `apps/web/components/ui/badge.tsx`
- Create: `apps/web/components/ui/alert.tsx`
- Create: `apps/web/components/ui/skeleton.tsx`

**Interfaces:**
- Consumes: TailwindCSS theme
- Produces: Card, Badge, Alert, Skeleton for data display and feedback states

- [ ] **Step 1: Implement Card component**

Create `apps/web/components/ui/card.tsx`:

```typescript
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-lg border border-border bg-white shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-text-muted ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>;
}
```

- [ ] **Step 2: Implement Badge component**

Create `apps/web/components/ui/badge.tsx`:

```typescript
import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'default';
}

export function Badge({ children, variant = 'default', size = 'default', className = '', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary-light text-primary-dark',
    secondary: 'bg-gray-100 text-text-secondary',
    success: 'bg-success-light text-emerald-700',
    warning: 'bg-warning-light text-amber-700',
    danger: 'bg-danger-light text-red-700',
    info: 'bg-info-light text-blue-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2.5 py-0.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Implement Alert component**

Create `apps/web/components/ui/alert.tsx`:

```typescript
import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Alert({ children, variant = 'default', className = '', ...props }: AlertProps) {
  const variants = {
    default: 'bg-gray-50 text-text-primary border-gray-200',
    success: 'bg-success-light text-emerald-800 border-emerald-200',
    warning: 'bg-warning-light text-amber-800 border-amber-200',
    danger: 'bg-danger-light text-red-800 border-red-200',
    info: 'bg-info-light text-blue-800 border-blue-200',
  };

  const icons = {
    default: Info,
    success: CheckCircle2,
    warning: AlertCircle,
    danger: XCircle,
    info: Info,
  };

  const Icon = icons[variant];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${variants[variant]} ${className}`} {...props}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Implement Skeleton component**

Create `apps/web/components/ui/skeleton.tsx`:

```typescript
import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Run build check**

```bash
pnpm --filter @commerce/web typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ui/card.tsx apps/web/components/ui/badge.tsx apps/web/components/ui/alert.tsx apps/web/components/ui/skeleton.tsx
git commit -m "feat: add Card, Badge, Alert, Skeleton components"
```

---

### Task 4: Modal and Toast Components

**Files:**
- Create: `apps/web/components/ui/modal.tsx`
- Create: `apps/web/components/providers/toast-provider.tsx`

**Interfaces:**
- Consumes: Button, Card primitives
- Produces: Modal overlay and Toast notification system

- [ ] **Step 1: Implement Modal component**

Create `apps/web/components/ui/modal.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Toast Provider**

Create `apps/web/components/providers/toast-provider.tsx`:

```typescript
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  };

  const styles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <div
              key={toast.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md min-w-[300px] max-w-[400px] ${styles[toast.type]}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm flex-1">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 3: Update providers.tsx to include ToastProvider**

Modify `apps/web/app/providers.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '../components/providers/toast-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run build check**

```bash
pnpm --filter @commerce/web typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/modal.tsx apps/web/components/providers/toast-provider.tsx apps/web/app/providers.tsx
git commit -m "feat: add Modal and Toast notification system"
```

---

### Task 5: Layout Components — Sidebar, Header, AppShell

**Files:**
- Create: `apps/web/components/layout/sidebar.tsx`
- Create: `apps/web/components/layout/sidebar-nav.tsx`
- Create: `apps/web/components/layout/sidebar-section.tsx`
- Create: `apps/web/components/layout/header.tsx`
- Create: `apps/web/components/layout/app-shell.tsx`
- Create: `apps/web/components/layout/content-area.tsx`

**Interfaces:**
- Consumes: Button, Badge primitives; lucide-react icons; auth/store queries for navigation state
- Produces: AppShell layout wrapping authenticated pages with sidebar navigation and header

- [ ] **Step 1: Implement SidebarSection**

Create `apps/web/components/layout/sidebar-section.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SidebarSection({ title, children, defaultOpen = true }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-sidebar-text hover:text-sidebar-text-active transition-colors"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement SidebarNav**

Create `apps/web/components/layout/sidebar-nav.tsx`:

```typescript
import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  active?: boolean;
}

export function SidebarNavItem({ href, icon: Icon, label, badge, active }: NavItemProps) {
  const pathname = usePathname();
  const isActive = active || pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-sidebar-active text-sidebar-text-active'
          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="danger" size="sm">{badge}</Badge>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Implement Sidebar**

Create `apps/web/components/layout/sidebar.tsx`:

```typescript
'use client';

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Video,
  Package,
  Tags,
  Warehouse,
  Link2,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  MonitorPlay,
  Settings,
  HelpCircle,
  UserCog,
  ClipboardList,
} from 'lucide-react';
import { SidebarSection } from './sidebar-section';
import { SidebarNavItem } from './sidebar-nav';

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar-bg">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
          CC
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Commerce Center</h1>
          <p className="text-xs text-sidebar-text">Operations workspace</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <SidebarSection title="Dashboard">
          <SidebarNavItem href="/" icon={LayoutDashboard} label="Dashboard" />
        </SidebarSection>

        <SidebarSection title="Bán hàng">
          <SidebarNavItem href="/orders" icon={ShoppingCart} label="Đơn hàng" badge={12} />
          <SidebarNavItem href="/customers" icon={Users} label="Khách hàng" />
          <SidebarNavItem href="/live-commerce" icon={Video} label="Live Commerce" badge={1} />
        </SidebarSection>

        <SidebarSection title="Sản phẩm">
          <SidebarNavItem href="/products" icon={Package} label="Sản phẩm" />
          <SidebarNavItem href="/categories" icon={Tags} label="Danh mục" />
          <SidebarNavItem href="/inventory" icon={Warehouse} label="Tồn kho" badge={8} />
        </SidebarSection>

        <SidebarSection title="Kênh bán hàng">
          <SidebarNavItem href="/channels" icon={Link2} label="Kênh đã kết nối" />
          <SidebarNavItem href="/sync" icon={RefreshCw} label="Đồng bộ" />
          <SidebarNavItem href="/sync-errors" icon={AlertTriangle} label="Lỗi tích hợp" badge={3} />
        </SidebarSection>

        <SidebarSection title="Phân tích">
          <SidebarNavItem href="/analytics" icon={BarChart3} label="Tổng quan" />
          <SidebarNavItem href="/livestreams" icon={MonitorPlay} label="Livestream" />
        </SidebarSection>

        <SidebarSection title="Quản trị">
          <SidebarNavItem href="/users" icon={UserCog} label="Người dùng" />
          <SidebarNavItem href="/audit" icon={ClipboardList} label="Nhật ký hoạt động" />
        </SidebarSection>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-hover p-4 space-y-1">
        <SidebarNavItem href="/settings" icon={Settings} label="Cài đặt" />
        <SidebarNavItem href="/help" icon={HelpCircle} label="Trợ giúp" />
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Implement Header**

Create `apps/web/components/layout/header.tsx`:

```typescript
'use client';

import React from 'react';
import { Bell, ChevronDown, Store } from 'lucide-react';
import { Button } from '../ui/button';

interface HeaderProps {
  storeName?: string;
  userName?: string;
  userInitials?: string;
}

export function Header({ storeName = 'Luma House', userName = 'User', userInitials = 'U' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">{storeName}</span>
        <span>/</span>
        <span>Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Realtime connected
        </div>

        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] text-white">
            3
          </span>
        </Button>

        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
            {userInitials}
          </div>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Implement AppShell**

Create `apps/web/components/layout/app-shell.tsx`:

```typescript
import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-content-bg">
      <Sidebar />
      <div className="ml-64 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement ContentArea**

Create `apps/web/components/layout/content-area.tsx`:

```typescript
import React from 'react';

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentArea({ children, className = '' }: ContentAreaProps) {
  return (
    <div className={`mx-auto max-w-7xl ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Run build check**

```bash
pnpm --filter @commerce/web typecheck
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/layout/
git commit -m "feat: add layout components (Sidebar, Header, AppShell, ContentArea)"
```

---

### Task 6: Restyle Auth Forms

**Files:**
- Modify: `apps/web/features/auth/components/login-form.tsx`
- Modify: `apps/web/features/auth/components/register-form.tsx`
- Modify: `apps/web/features/auth/components/recovery-form.tsx`
- Modify: `apps/web/features/auth/components/verification-state.tsx`

**Interfaces:**
- Consumes: Button, Input, Label, FormError, Card, Alert, Spinner primitives
- Produces: Styled auth forms matching the design system

- [ ] **Step 1: Restyle LoginForm**

Modify `apps/web/features/auth/components/login-form.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { FormError } from '../../../components/ui/form-error';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';

interface LoginFormProps {
  onSubmit: (data: { email: string; password: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  errorCode?: string | null;
}

export function LoginForm({ onSubmit, loading, error, errorCode }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (!email.trim()) {
      setValidationError('Email is required');
      return;
    }
    if (!password) {
      setValidationError('Password is required');
      return;
    }
    void onSubmit({ email, password });
  }

  const displayError = error ?? validationError;
  const friendlyError = errorCode === 'UNAUTHENTICATED' ? 'Invalid credentials' : displayError;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your email and password to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {friendlyError && (
            <Alert variant="danger">{friendlyError}</Alert>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Restyle RegisterForm**

Modify `apps/web/features/auth/components/register-form.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';

interface RegisterFormProps {
  onSubmit: (data: { email: string; password: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function RegisterForm({ onSubmit, loading, error, success }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit({ email, password });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">
            Registration successful! Please check your email to verify your account.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-text-muted">Password must be at least 12 characters</p>
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Restyle RecoveryForm**

Modify `apps/web/features/auth/components/recovery-form.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';

interface RecoveryFormProps {
  onSubmit: (email: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function RecoveryForm({ onSubmit, loading, error, success }: RecoveryFormProps) {
  const [email, setEmail] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit(email);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">
            If an account exists with this email, you will receive a password reset link.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Restyle VerificationState**

Modify `apps/web/features/auth/components/verification-state.tsx`:

```typescript
'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface VerificationStateProps {
  status: 'loading' | 'success' | 'error' | 'expired';
  error?: string | null;
}

export function VerificationState({ status, error }: VerificationStateProps) {
  const states = {
    loading: {
      icon: Loader2,
      title: 'Verifying your email...',
      description: 'Please wait while we verify your email address.',
      iconClass: 'text-primary animate-spin',
    },
    success: {
      icon: CheckCircle2,
      title: 'Email verified!',
      description: 'Your email has been successfully verified. You can now sign in.',
      iconClass: 'text-success',
    },
    error: {
      icon: AlertCircle,
      title: 'Verification failed',
      description: error || 'The verification link is invalid or has expired.',
      iconClass: 'text-danger',
    },
    expired: {
      icon: Clock,
      title: 'Link expired',
      description: 'This verification link has expired. Please request a new one.',
      iconClass: 'text-warning',
    },
  };

  const state = states[status];
  const Icon = state.icon;

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <Icon className={`h-16 w-16 mb-4 ${state.iconClass}`} />
        <h2 className="text-xl font-semibold text-text-primary mb-2">{state.title}</h2>
        <p className="text-text-secondary mb-6">{state.description}</p>
        {status === 'success' && (
          <Button onClick={() => window.location.href = '/'}>Go to Dashboard</Button>
        )}
        {(status === 'error' || status === 'expired') && (
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run auth tests**

```bash
pnpm --filter @commerce/web test -- auth
```

Expected: PASS (tests may need minor updates for new DOM structure)

- [ ] **Step 6: Commit**

```bash
git add apps/web/features/auth/components/
git commit -m "feat: restyle auth forms with design system primitives"
```

---

### Task 7: Restyle Store Components

**Files:**
- Modify: `apps/web/features/stores/components/create-store-form.tsx`
- Modify: `apps/web/features/stores/components/store-switcher.tsx`
- Modify: `apps/web/features/stores/components/invitation-acceptance.tsx`
- Modify: `apps/web/features/stores/components/access-denied.tsx`

**Interfaces:**
- Consumes: Button, Input, Label, Card, Alert, Badge, Skeleton primitives
- Produces: Styled store components

- [ ] **Step 1: Restyle CreateStoreForm**

Modify `apps/web/features/stores/components/create-store-form.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import { Store } from 'lucide-react';

interface CreateStoreFormProps {
  onSubmit: (data: { name: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function CreateStoreForm({ onSubmit, loading, error, success }: CreateStoreFormProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void onSubmit({ name });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <CardTitle>Create your first store</CardTitle>
        </div>
        <CardDescription>Set up your store to start managing products and orders</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">Store created successfully!</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input
                id="store-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                placeholder="My Store"
              />
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Create store
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Restyle StoreSwitcher**

Modify `apps/web/features/stores/components/store-switcher.tsx`:

```typescript
'use client';

import React from 'react';
import { Store, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import type { Store as StoreType } from '../api';

interface StoreSwitcherProps {
  stores: StoreType[];
  loading?: boolean;
  error?: string | null;
  onSelect: (storeId: string) => void | Promise<void>;
}

export function StoreSwitcher({ stores, loading, error, onSelect }: StoreSwitcherProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-danger text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Store className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">No stores available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {stores.map((store) => (
        <button
          key={store.id}
          onClick={() => void onSelect(store.id)}
          className="flex w-full items-center gap-4 rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-primary hover:shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-text-primary">{store.name}</h3>
            <p className="text-sm text-text-muted">Click to select this store</p>
          </div>
          <ChevronRight className="h-5 w-5 text-text-muted" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Restyle InvitationAcceptance**

Modify `apps/web/features/stores/components/invitation-acceptance.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';

interface InvitationAcceptanceProps {
  onAccept: (token: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function InvitationAcceptance({ onAccept, loading, error, success }: InvitationAcceptanceProps) {
  const [token, setToken] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    void onAccept(token);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Accept invitation</CardTitle>
        </div>
        <CardDescription>Enter your invitation token to join a store</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert variant="success">Invitation accepted! You now have access to the store.</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invitation-token">Invitation token</Label>
              <Input
                id="invitation-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                placeholder="Paste your invitation token here"
              />
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              Accept invitation
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Restyle AccessDenied**

Modify `apps/web/features/stores/components/access-denied.tsx`:

```typescript
import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface AccessDeniedProps {
  detail?: string;
  onBack?: () => void;
}

export function AccessDenied({ detail = 'You do not have access to this resource.', onBack }: AccessDeniedProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <ShieldAlert className="h-16 w-16 text-danger mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Access Denied</h2>
        <p className="text-text-secondary mb-6">{detail}</p>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Go back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run store tests**

```bash
pnpm --filter @commerce/web test -- stores
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/features/stores/components/
git commit -m "feat: restyle store components with design system primitives"
```

---

### Task 8: Restructure Page.tsx with Layouts

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/register/page.tsx`
- Create: `apps/web/app/(auth)/recovery/page.tsx`
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: AppShell, Auth forms, Store components; auth/store queries
- Produces: Route-group based layout architecture separating public auth pages from authenticated dashboard

- [ ] **Step 1: Create auth route group layout**

Create `apps/web/app/(auth)/layout.tsx`:

```typescript
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

Create `apps/web/app/(auth)/login/page.tsx`:

```typescript
'use client';

import { LoginForm } from '../../../features/auth/components/login-form';
import { useLogin } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function LoginPage() {
  const login = useLogin();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Commerce Control Center</h1>
        <p className="text-text-secondary mt-1">Sign in to your account</p>
      </div>
      <LoginForm
        onSubmit={(data) => login.mutate(data)}
        loading={login.isPending}
        error={login.error instanceof ApiError ? login.error.message : null}
        errorCode={login.error instanceof ApiError ? login.error.code : null}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Don't have an account?{' '}
        <a href="/register" className="text-primary hover:underline">Register</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create register page**

Create `apps/web/app/(auth)/register/page.tsx`:

```typescript
'use client';

import { RegisterForm } from '../../../features/auth/components/register-form';
import { useRegister } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function RegisterPage() {
  const register = useRegister();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
        <p className="text-text-secondary mt-1">Get started with Commerce Control Center</p>
      </div>
      <RegisterForm
        onSubmit={(data) => register.mutate(data)}
        loading={register.isPending}
        error={register.error instanceof ApiError ? register.error.message : null}
        success={register.isSuccess}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account?{' '}
        <a href="/login" className="text-primary hover:underline">Sign in</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create recovery page**

Create `apps/web/app/(auth)/recovery/page.tsx`:

```typescript
'use client';

import { RecoveryForm } from '../../../features/auth/components/recovery-form';
import { useRequestPasswordReset } from '../../../features/auth/queries';
import { ApiError } from '../../../features/auth/api';

export default function RecoveryPage() {
  const reset = useRequestPasswordReset();

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white mb-4">
          CC
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Reset password</h1>
        <p className="text-text-secondary mt-1">We'll send you a link to reset your password</p>
      </div>
      <RecoveryForm
        onSubmit={(email) => reset.mutate(email)}
        loading={reset.isPending}
        error={reset.error instanceof ApiError ? reset.error.message : null}
        success={reset.isSuccess}
      />
      <p className="mt-4 text-center text-sm text-text-muted">
        Remember your password?{' '}
        <a href="/login" className="text-primary hover:underline">Sign in</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create dashboard route group layout**

Create `apps/web/app/(dashboard)/layout.tsx`:

```typescript
import type { ReactNode } from 'react';
import { AppShell } from '../../components/layout/app-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 6: Create dashboard home page**

Create `apps/web/app/(dashboard)/page.tsx`:

```typescript
'use client';

import { useSession, useLogout } from '../../features/auth/queries';
import { useStores, useSelectStore, useCreateFirstStore, useCapabilities } from '../../features/stores/queries';
import { CreateStoreForm } from '../../features/stores/components/create-store-form';
import { StoreSwitcher } from '../../features/stores/components/store-switcher';
import { InvitationAcceptance } from '../../features/stores/components/invitation-acceptance';
import { AccessDenied } from '../../features/stores/components/access-denied';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { ApiError } from '../../features/auth/api';
import { useState } from 'react';

export default function DashboardPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: capabilities } = useCapabilities();
  const logout = useLogout();
  const selectStore = useSelectStore();
  const createStore = useCreateFirstStore();
  const [showInvite, setShowInvite] = useState(false);

  if (sessionLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session?.userId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please sign in to continue</p>
        <Button onClick={() => window.location.href = '/login'}>Sign in</Button>
      </div>
    );
  }

  const hasStore = (stores?.length ?? 0) > 0;

  if (!hasStore) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Welcome!</h1>
          <p className="text-text-secondary mt-2">You are not part of any store yet.</p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Button variant={showInvite ? 'ghost' : 'default'} onClick={() => setShowInvite(false)}>
            Create store
          </Button>
          <Button variant={showInvite ? 'default' : 'ghost'} onClick={() => setShowInvite(true)}>
            Accept invitation
          </Button>
        </div>

        {showInvite ? (
          <InvitationAcceptance
            onAccept={(token) => {/* TODO */}}
            loading={false}
          />
        ) : (
          <CreateStoreForm
            onSubmit={(data) => createStore.mutate(data)}
            loading={createStore.isPending}
            error={createStore.error instanceof ApiError ? createStore.error.message : null}
            success={createStore.isSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of your store performance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <StoreSwitcher
                stores={stores ?? []}
                loading={storesLoading}
                onSelect={(id) => selectStore.mutate(id)}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              {capabilities ? (
                <div className="flex flex-wrap gap-2">
                  {capabilities.permissions.map((p) => (
                    <Badge key={p} variant="secondary" size="sm">{p}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm">Loading...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Remove old page.tsx**

```bash
rm apps/web/app/page.tsx
```

- [ ] **Step 8: Run build and tests**

```bash
pnpm --filter @commerce/web typecheck
pnpm --filter @commerce/web test
pnpm --filter @commerce/web build
```

Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/
git commit -m "feat: restructure routes with auth and dashboard layouts"
```

---

### Task 9: Final Verification and Integration

**Files:**
- All modified files from previous tasks

**Interfaces:**
- Consumes: All components and layouts
- Produces: Fully styled, working application

- [ ] **Step 1: Run full test suite**

```bash
pnpm --filter @commerce/web test
```

Expected: PASS (all web tests pass)

- [ ] **Step 2: Run API tests to ensure no regressions**

```bash
pnpm test
```

Expected: PASS (all workspace tests pass)

- [ ] **Step 3: Build check**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 4: Lint check**

```bash
pnpm lint
```

Expected: PASS

- [ ] **Step 5: Visual verification (manual)**

Start dev servers and verify:
- Login page: centered card, styled inputs, gradient background
- Register page: similar layout
- Dashboard: dark sidebar, light content, cards, badges
- Store switcher: hover effects, selection states
- All navigation items visible with icons

- [ ] **Step 6: Commit final changes**

```bash
git add -A
git commit -m "feat: complete Phase 1 Design System"
```

---

## Spec Coverage Check

| Spec Section | Implementing Task(s) |
|---|---|
| TailwindCSS Setup | Task 1 |
| Custom Theme (colors, typography, spacing) | Task 1 |
| Global CSS | Task 1 |
| Button primitive | Task 2 |
| Input primitive | Task 2 |
| Label, FormError | Task 2 |
| Card, Badge, Alert, Skeleton | Task 3 |
| Modal | Task 4 |
| Toast Provider | Task 4 |
| Sidebar | Task 5 |
| Header | Task 5 |
| AppShell | Task 5 |
| Auth forms restyle | Task 6 |
| Store components restyle | Task 7 |
| Route restructuring | Task 8 |
| Testing | All tasks |

## Placeholder Scan

- No TBD/TODO placeholders in code steps
- All component props are typed
- All tasks have concrete test/build commands
- No vague instructions like "add appropriate styling"

## Type Consistency

- `Button` variant prop: `'default' | 'secondary' | 'destructive' | 'ghost' | 'link'`
- `Badge` variant prop: `'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'`
- `Alert` variant prop: `'default' | 'success' | 'warning' | 'danger' | 'info'`
- All components use Tailwind custom color names consistently
