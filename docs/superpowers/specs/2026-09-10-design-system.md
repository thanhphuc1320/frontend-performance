# Phase 1 — Design System Architectural Design

## Status

Approved. This document defines the UI foundation layer for the Commerce Control Center. It establishes the visual system, component library, and layout architecture required before business-domain UI phases (Products, Orders, Inventory, Dashboard).

## Scope

This subsystem includes:

- TailwindCSS v4 setup with custom theme matching the visual reference
- Global CSS foundation (reset, typography, colors, spacing)
- Application Shell (persistent dark sidebar + light content area)
- Navigation component (sidebar with icons, sections, badges, active states)
- UI Primitive components (Button, Input, Card, Badge, Modal, Toast, Table, Alert, Skeleton)
- Layout components (AppShell, Sidebar, Header, ContentArea)
- Feature component restyling (Auth forms, Store forms, Store switcher)
- Icon system via lucide-react

It excludes:
- Business-domain components (Product cards, Order tables, Inventory charts)
- Dashboard widgets and KPI cards
- Realtime indicators and charts
- Animation beyond basic transitions

## Visual Reference

Source: `design/commerce-control-center-preview.png`

Key visual characteristics:
- **Sidebar**: Dark navy (`#0f172a` or similar), persistent, collapsible sections, icon + label navigation items, notification badges, active item highlighting
- **Content Area**: Light gray background (`#f8fafc` or similar), white cards with subtle shadows, clean typography
- **Header**: Store context breadcrumb, user avatar, notification bell, realtime status indicator
- **Cards**: White background, rounded corners (`border-radius: 0.75rem`), subtle shadow (`shadow-sm` or `shadow`), clear header/title area
- **Typography**: Sans-serif (Inter or system-ui), clear hierarchy (h1 for page titles, h2 for section headers, body for content)
- **Form Inputs**: White background, subtle border (`border-gray-200`), focus ring (`ring-2 ring-primary`), rounded corners
- **Buttons**: Primary (solid blue), Secondary (outline), Danger (red), Ghost (text only)
- **Status Badges**: Success (green), Warning (amber), Danger (red), Info (blue), each with light background variant

## Design Tokens

### Colors

```
--color-primary: #3b82f6          /* Blue 500 */
--color-primary-dark: #2563eb     /* Blue 600 */
--color-primary-light: #dbeafe    /* Blue 100 */
--color-sidebar-bg: #0f172a       /* Slate 900 */
--color-sidebar-hover: #1e293b    /* Slate 800 */
--color-sidebar-active: #334155   /* Slate 700 */
--color-sidebar-text: #94a3b8     /* Slate 400 */
--color-sidebar-text-active: #f8fafc /* Slate 50 */
--color-content-bg: #f8fafc       /* Slate 50 */
--color-card-bg: #ffffff
--color-border: #e2e8f0           /* Slate 200 */
--color-text-primary: #0f172a     /* Slate 900 */
--color-text-secondary: #64748b   /* Slate 500 */
--color-text-muted: #94a3b8       /* Slate 400 */
--color-success: #10b981          /* Emerald 500 */
--color-success-light: #d1fae5    /* Emerald 100 */
--color-warning: #f59e0b          /* Amber 500 */
--color-warning-light: #fef3c7    /* Amber 100 */
--color-danger: #ef4444           /* Red 500 */
--color-danger-light: #fee2e2     /* Red 100 */
--color-info: #3b82f6             /* Blue 500 */
--color-info-light: #dbeafe       /* Blue 100 */
```

### Typography

```
Font family: Inter, system-ui, -apple-system, sans-serif
Font sizes:
  xs: 0.75rem     (12px)
  sm: 0.875rem    (14px)
  base: 1rem      (16px)
  lg: 1.125rem    (18px)
  xl: 1.25rem     (20px)
  2xl: 1.5rem     (24px)
  3xl: 1.875rem   (30px)
Font weights:
  normal: 400
  medium: 500
  semibold: 600
  bold: 700
Line heights:
  tight: 1.25
  normal: 1.5
  relaxed: 1.625
```

### Spacing

```
Base unit: 0.25rem (4px)
Scale: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64
Border radius:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
Shadows:
  sm: 0 1px 2px 0 rgba(0,0,0,0.05)
  DEFAULT: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)
  md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)
  lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)
```

## Architecture

### Tailwind Configuration

Use TailwindCSS v4 with PostCSS. Configuration in `tailwind.config.ts` with:
- Custom colors mapped to CSS custom properties
- Custom font family (Inter)
- Custom spacing scale extensions
- Custom border radius
- Custom shadows
- Content paths for `app/**/*.{ts,tsx}` and `features/**/*.{ts,tsx}`

### Component Organization

```
components/
  ui/                    # Primitive UI components (no business logic)
    button.tsx
    input.tsx
    card.tsx
    badge.tsx
    modal.tsx
    toast.tsx
    table.tsx
    alert.tsx
    skeleton.tsx
    spinner.tsx
    label.tsx
    form-error.tsx
    separator.tsx
  layout/                # Layout components
    app-shell.tsx        # Sidebar + Content wrapper
    sidebar.tsx          # Navigation sidebar
    sidebar-nav.tsx      # Navigation items within sidebar
    sidebar-section.tsx  # Collapsible section in sidebar
    header.tsx           # Top header bar
    content-area.tsx     # Main content wrapper
  providers/
    toast-provider.tsx   # Toast context + container
```

### Component Specifications

#### Button

Variants: `default` (primary solid), `secondary` (outline), `destructive` (red solid), `ghost` (text only), `link` (text with underline)
Sizes: `sm`, `default`, `lg`, `icon`
States: disabled, loading (with spinner)

#### Input

States: default, focus, error, disabled
Features: left/right icons, clear button, password toggle

#### Card

Sections: header (title + optional action), content, footer
Variants: default, compact

#### Badge

Variants: `default`, `secondary`, `success`, `warning`, `danger`, `info`
Sizes: `sm`, `default`

#### Modal

Features: overlay backdrop, centered content, close button (X), header, body, footer with action buttons
Accessibility: focus trap, escape to close, aria attributes

#### Toast

Types: `success`, `error`, `warning`, `info`
Features: auto-dismiss (5s), progress bar, close button, action button support
Position: top-right

#### Table

Features: header row, sortable columns, row hover, empty state, loading state (skeleton)

#### Sidebar

Sections: Brand/logo area, Navigation groups (Dashboard, Bán hàng, Sản phẩm, Kênh bán hàng, Phân tích, Quản trị), Bottom section (Settings, Help)
Features: Collapsible groups, active item highlight, icon + label, notification badges, tooltip on collapse

### Layout Architecture

```
AppShell
├── Sidebar (fixed left, full height, 260px width)
│   ├── Brand
│   ├── Navigation
│   └── User section
├── Main (margin-left: 260px, min-height: 100vh)
│   ├── Header (sticky top, height: 64px)
│   │   ├── Breadcrumb (Store name / Page)
│   │   ├── Actions (notifications, user menu)
│   │   └── Store switcher
│   └── ContentArea (padding, scrollable)
│       └── Page content
```

### Routing & Layout Strategy

- **Public pages** (login, register, recovery): Full-screen centered layout, NO sidebar
- **Authenticated pages**: AppShell with sidebar + content
- **Auth guard** at layout level: redirect unauthenticated users to login

### State & Context

- `ToastProvider`: Context for imperatively showing toasts from anywhere
- `SidebarContext`: Mobile sidebar open/close state

## Migration Plan for Existing Components

### Auth Forms
- LoginForm: Centered card on gradient background, styled inputs, primary button
- RegisterForm: Similar layout, add "back to login" link
- RecoveryForm: Minimal card, single input
- VerificationState: Centered status icon + message + action button

### Store Components
- CreateStoreForm: Card layout, styled input, submit button
- StoreSwitcher: Card list with hover effects, selection indicator
- InvitationAcceptance: Card with token input
- AccessDenied: Centered error illustration + message + action

### Page.tsx Restructure
- Extract view logic into separate page components or keep in page.tsx but wrap in AppShell
- Public views (login/register/recovery): use centered layout
- Authenticated views (dashboard): use AppShell layout

## Testing Strategy

- Unit tests for UI primitives (Button, Input, Badge rendering + variants)
- Component tests for composite components (Modal open/close, Toast display/dismiss)
- Visual regression NOT required at this phase
- Ensure existing E2E tests still pass after restyling

## Dependencies

```
# New dependencies
tailwindcss ^4.x
@tailwindcss/postcss ^4.x
lucide-react ^0.x

# Dev dependencies (if not already present)
postcss ^8.x
```

## Scope Exclusions

- Chart/visualization components (deferred to Dashboard phase)
- Product-specific cards and grids
- Order detail views
- Realtime update animations
- Mobile-responsive sidebar (basic responsive only)
- Theme switching (dark mode for content area)

## References

- Visual source: `design/commerce-control-center-preview.png`
- Original plan: `docs/06-acceptance-and-development.md` Phase 1
- Tech spec: `docs/04-technical-spec.md` (TailwindCSS mentioned)
