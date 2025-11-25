# Design Document - UI/UX Redesign

## Overview

This design document outlines a comprehensive redesign of the Alert Monitoring System's user interface to achieve a world-class, professional appearance. The redesign focuses on modern design principles, consistent visual language, smooth interactions, and exceptional user experience while maintaining the existing functionality.

### Design Philosophy

- **Modern & Clean**: Embrace contemporary design trends with clean lines, ample whitespace, and subtle depth
- **Consistent**: Establish a design system that ensures visual consistency across all components
- **Accessible**: Maintain WCAG 2.1 AA compliance with proper contrast, focus states, and keyboard navigation
- **Performant**: Use CSS-based animations and optimized assets for smooth 60fps interactions
- **Responsive**: Design mobile-first with graceful scaling to larger screens

## Architecture

### Design System Structure

```
Design System
├── Foundation
│   ├── Color Palette
│   ├── Typography
│   ├── Spacing System
│   ├── Shadows & Elevation
│   └── Border Radius
├── Components
│   ├── Buttons
│   ├── Cards
│   ├── Forms
│   ├── Tables
│   ├── Modals
│   ├── Badges
│   └── Navigation
└── Patterns
    ├── Layouts
    ├── Data Visualization
    ├── Loading States
    └── Empty States
```

## Design Foundations

### Color Palette

**Primary Colors:**
```css
--primary-50: #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* Main primary */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

**Semantic Colors:**
```css
--success: #10b981;
--success-light: #d1fae5;
--warning: #f59e0b;
--warning-light: #fef3c7;
--error: #ef4444;
--error-light: #fee2e2;
--info: #3b82f6;
--info-light: #dbeafe;
```

**Severity Colors:**
```css
--severity-critical: #dc2626;
--severity-high: #f97316;
--severity-medium: #eab308;
--severity-low: #22c55e;
```

**Neutral Colors:**
```css
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

**Dark Mode Colors:**
```css
--dark-bg-primary: #0f172a;
--dark-bg-secondary: #1e293b;
--dark-bg-tertiary: #334155;
--dark-text-primary: #f1f5f9;
--dark-text-secondary: #cbd5e1;
--dark-border: #475569;
```

### Typography

**Font Stack:**
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Type Scale:**
```css
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
```

**Font Weights:**
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing System

**8px Grid System:**
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Shadows & Elevation

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### Border Radius

```css
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-2xl: 1rem;     /* 16px */
--radius-full: 9999px;  /* Fully rounded */
```

### Transitions

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

## Component Designs

### Buttons

**Primary Button:**
- Background: `--primary-600`
- Hover: `--primary-700` with slight elevation
- Active: `--primary-800` with pressed effect
- Disabled: `--gray-300` with reduced opacity
- Padding: `--space-3` `--space-6`
- Border radius: `--radius-lg`
- Font weight: `--font-semibold`
- Transition: all `--transition-base`

**Secondary Button:**
- Background: transparent
- Border: 1px solid `--gray-300`
- Hover: `--gray-50` background
- Text color: `--gray-700`

**Danger Button:**
- Background: `--error`
- Hover: darker red with elevation

### Cards

**Standard Card:**
- Background: white
- Border: 1px solid `--gray-200`
- Border radius: `--radius-xl`
- Padding: `--space-6`
- Shadow: `--shadow-sm`
- Hover: `--shadow-md` (for interactive cards)
- Transition: shadow `--transition-base`

**Card Header:**
- Border bottom: 1px solid `--gray-100`
- Padding bottom: `--space-4`
- Margin bottom: `--space-4`

### Tables

**Table Styling:**
- Border: 1px solid `--gray-200`
- Border radius: `--radius-lg`
- Overflow: hidden for rounded corners

**Table Header:**
- Background: `--gray-50`
- Font weight: `--font-semibold`
- Text transform: uppercase
- Font size: `--text-xs`
- Letter spacing: 0.05em
- Color: `--gray-600`
- Padding: `--space-3` `--space-4`

**Table Rows:**
- Border bottom: 1px solid `--gray-100`
- Hover: `--gray-50` background
- Transition: background `--transition-fast`
- Padding: `--space-4`

**Alternating Rows:**
- Even rows: white
- Odd rows: `--gray-50` (optional, for dense tables)

### Forms

**Input Fields:**
- Border: 1px solid `--gray-300`
- Border radius: `--radius-lg`
- Padding: `--space-3` `--space-4`
- Font size: `--text-base`
- Transition: border-color `--transition-fast`
- Focus: border `--primary-500`, ring shadow

**Input States:**
- Focus: 2px ring `--primary-200`
- Error: border `--error`, ring `--error-light`
- Success: border `--success`, ring `--success-light`
- Disabled: background `--gray-100`, cursor not-allowed

**Labels:**
- Font weight: `--font-medium`
- Font size: `--text-sm`
- Color: `--gray-700`
- Margin bottom: `--space-2`

### Modals

**Modal Overlay:**
- Background: rgba(0, 0, 0, 0.5)
- Backdrop filter: blur(4px)
- Animation: fade in `--transition-base`

**Modal Container:**
- Background: white
- Border radius: `--radius-2xl`
- Shadow: `--shadow-2xl`
- Max width: 32rem (medium), 48rem (large)
- Padding: `--space-8`
- Animation: fade + scale from 0.95 to 1

**Modal Header:**
- Font size: `--text-2xl`
- Font weight: `--font-bold`
- Margin bottom: `--space-6`
- Close button: top-right, hover effect

### Badges & Chips

**Severity Badges:**
- Critical: background `--severity-critical`, white text
- High: background `--severity-high`, white text
- Medium: background `--severity-medium`, dark text
- Low: background `--severity-low`, white text
- Padding: `--space-1` `--space-3`
- Border radius: `--radius-full`
- Font size: `--text-xs`
- Font weight: `--font-semibold`
- Text transform: uppercase
- Letter spacing: 0.05em

**State Chips:**
- Similar styling to badges
- Include icon prefix
- Slightly larger padding

### Navigation

**Header:**
- Background: white
- Border bottom: 1px solid `--gray-200`
- Shadow: `--shadow-sm`
- Height: 64px
- Sticky positioning
- Z-index: 50

**Nav Links:**
- Color: `--gray-600`
- Hover: `--primary-600`
- Active: `--primary-600` with bottom border
- Padding: `--space-4` `--space-6`
- Transition: color `--transition-fast`

### Charts

**Chart Styling:**
- Use color palette for consistency
- Smooth curves with tension
- Grid lines: `--gray-200`
- Tooltips: card-style with shadow
- Legend: horizontal, bottom placement
- Responsive: maintain aspect ratio

### Loading States

**Skeleton Loaders:**
- Background: `--gray-200`
- Animation: shimmer effect
- Border radius: matches content
- Height: matches expected content

**Spinners:**
- Border: 2px solid `--gray-200`
- Border top: 2px solid `--primary-600`
- Animation: spin 0.6s linear infinite
- Size: 16px (small), 24px (medium), 32px (large)

### Empty States

**Container:**
- Text align: center
- Padding: `--space-12` `--space-6`
- Color: `--gray-500`

**Icon:**
- Size: 48px
- Color: `--gray-400`
- Margin bottom: `--space-4`

**Message:**
- Font size: `--text-lg`
- Font weight: `--font-medium`
- Margin bottom: `--space-2`

**Description:**
- Font size: `--text-sm`
- Color: `--gray-500`
- Margin bottom: `--space-6`

## Layout Patterns

### Dashboard Grid

**Desktop (≥1024px):**
- 12-column grid
- Gap: `--space-6`
- KPI cards: 3 columns each (4 cards per row)
- Charts: 6 columns each (2 per row)
- Tables: full width (12 columns)

**Tablet (768px - 1023px):**
- 8-column grid
- Gap: `--space-4`
- KPI cards: 4 columns each (2 cards per row)
- Charts: full width (8 columns)

**Mobile (<768px):**
- Single column
- Gap: `--space-4`
- All elements: full width
- Reduced padding

### Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

## Animation Guidelines

### Micro-interactions

**Hover Effects:**
- Duration: 150ms
- Easing: ease-out
- Properties: background-color, transform, box-shadow

**Button Press:**
- Scale: 0.98
- Duration: 100ms
- Easing: ease-in

**Card Hover:**
- Elevation increase (shadow)
- Duration: 200ms
- Slight scale: 1.02 (optional)

### Page Transitions

**Fade In:**
- Opacity: 0 to 1
- Duration: 300ms
- Easing: ease-out

**Slide In:**
- Transform: translateY(10px) to translateY(0)
- Opacity: 0 to 1
- Duration: 300ms
- Easing: ease-out

## Accessibility Considerations

### Focus States

- Visible outline: 2px solid `--primary-500`
- Outline offset: 2px
- Never remove focus indicators

### Color Contrast

- Text on background: minimum 4.5:1
- Large text (18px+): minimum 3:1
- Interactive elements: minimum 3:1

### Touch Targets

- Minimum size: 44x44 pixels
- Adequate spacing between targets
- Larger targets on mobile

## Dark Mode Implementation

### Color Adjustments

- Background: `--dark-bg-primary`
- Cards: `--dark-bg-secondary`
- Borders: `--dark-border`
- Text: `--dark-text-primary`
- Shadows: darker, more subtle

### Toggle Implementation

- Persist preference in localStorage
- Smooth transition between modes
- Update all components dynamically
- Maintain contrast ratios

## Performance Optimization

### CSS Best Practices

- Use CSS custom properties for theming
- Minimize repaints with transform and opacity
- Use will-change sparingly
- Leverage GPU acceleration for animations

### Asset Optimization

- Use SVG for icons
- Optimize images with proper formats
- Lazy load below-the-fold content
- Minimize CSS bundle size

## Implementation Priority

### Phase 1: Foundation
1. Implement design system CSS variables
2. Update base typography and spacing
3. Create utility classes

### Phase 2: Core Components
1. Redesign buttons and forms
2. Update cards and containers
3. Enhance tables

### Phase 3: Dashboard Layouts
1. Redesign Owner Dashboard
2. Redesign Admin Dashboard
3. Update navigation

### Phase 4: Polish
1. Add micro-interactions
2. Implement loading states
3. Add empty states
4. Final responsive adjustments

### Phase 5: Dark Mode
1. Define dark mode colors
2. Implement toggle
3. Test all components
4. Persist preference
