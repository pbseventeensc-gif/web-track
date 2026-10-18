# Design System Master File (Soft Pastel Edition)

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Web-Track
**Generated:** 2026-10-18 16:34:00
**Category:** Logistics/Delivery & Production Tracking
**Design Dials:** Variance 7/10 (Balanced / Modern) | Motion 5/10 (Standard) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette (Soft Tonal & Pastel System — Zero Solid Fills)

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Primary Accent | `#2563EB` | `--color-primary` | Active text, icons, focus rings, borders |
| Primary Soft Surface | `#EFF6FF` | `--color-primary-soft` | Active nav item, primary soft button surface |
| Secondary Accent | `#3B82F6` | `--color-secondary` | Secondary interactive icons & highlights |
| Accent / CTA Text | `#C2410C` | `--color-accent` | Warm operational accent text & icons |
| Accent Soft Surface | `#FFF7ED` | `--color-accent-soft` | Soft orange/amber operational badge & CTA surface |
| Background | `#F4F8FD` | `--color-background` | App canvas background (soft cool-blue tint) |
| Foreground | `#1E3A8A` | `--color-foreground` | Primary technical headings & strong text |
| Card | `#FFFFFF` | `--color-card` | Elevated card & panel surface |
| Card Foreground | `#1E293B` | `--color-card-foreground` | Standard body & table text |
| Muted | `#E9EFF8` | `--color-muted` | Subtle container, table header, & badge background |
| Muted Foreground | `#475569` | `--color-muted-foreground` | Secondary labels, captions, & metadata |
| Border | `#BFDBFE` | `--color-border` | Soft blue-tinted structural border |
| Destructive Text | `#BE123C` | `--color-destructive` | Delete / logout text & icon |
| Destructive Soft Surface | `#FFF1F2` | `--color-destructive-soft` | Soft rose button & alert surface |
| Ring | `#2563EB` | `--color-ring` | Accessible keyboard focus ring |

**Color Notes:** Strictly soft pastel/tonal surfaces (`#EFF6FF`, `#E9EFF8`, `#FFF7ED`, `#ECFDF5`, `#FFF1F2`) paired with high-contrast legible text (`#1E40AF`, `#1E293B`, `#C2410C`, `#047857`, `#BE123C`) and subtle borders (`#BFDBFE`, `#E2E8F0`). Never use solid saturated background fills on buttons, badges, or cards.

### Typography

- **Heading & Technical Font:** `Fira Code` (monospace technical precision for codes, metrics, section labels)
- **Body Font:** `Fira Sans` / `Plus Jakarta Sans` (clean geometric legibility for dense operational tables & UI controls)
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Google Fonts:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap');
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.04)` | Subtle lift for cards, header, sidebar |
| `--shadow-md` | `0 4px 10px rgba(30, 64, 175, 0.06)` | Interactive cards, active popovers |
| `--shadow-lg` | `0 10px 20px rgba(15, 23, 42, 0.08)` | Modals, floating dropdowns |
| `--shadow-xl` | `0 20px 30px rgba(15, 23, 42, 0.12)` | Full-screen previews |

---

## Component Specs

### Buttons (Soft Pastel Tonal System)

```css
/* Primary Soft Button (Blue Tonal) */
.btn-primary {
  background: #EFF6FF;
  color: #1D4ED8;
  border: 1px solid #BFDBFE;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #DBEAFE;
  border-color: #93C5FD;
}

/* Accent Soft Button (Warm Amber/Orange Tonal) */
.btn-accent {
  background: #FFF7ED;
  color: #C2410C;
  border: 1px solid #FED7AA;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

/* Secondary / Neutral Soft Button */
.btn-secondary {
  background: #E9EFF8;
  color: #334155;
  border: 1px solid #CBD5E1;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 1px solid #DBEAFE;
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 200ms ease;
}
```

### Inputs

```css
.input {
  padding: 10px 14px;
  border: 1px solid #CBD5E1;
  border-radius: 12px;
  font-size: 13px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input:focus {
  border-color: #2563EB;
  outline: none;
  box-shadow: 0 0 0 3px #2563EB20;
}
```
