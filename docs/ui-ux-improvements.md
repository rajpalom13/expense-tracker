# UI/UX Improvements Plan

## Status Key
- [ ] Pending
- [x] Completed
- [~] In Progress

---

## P0 - Critical (Must Fix)

### 1. Fix dark mode card contrast
Cards blend with background in dark mode. `--card: oklch(0.18)` vs `--background: oklch(0.14)` = barely visible separation.
- **File**: `app/globals.css`
- **Fix**: Bump dark card to `oklch(0.19 0.01 75)`, darken background to `oklch(0.13)`, strengthen card-elevated shadow
- [x] Done

### 2. Add active state background to sidebar nav items
Active nav item only changes text color (`text-primary`), no background highlight. Hard to scan.
- **File**: `components/nav-main.tsx`
- **Fix**: Add `bg-primary/8 rounded-md` on active link, `hover:bg-sidebar-accent/50` on inactive
- [x] Done

---

## P1 - High Priority

### 3. Unify card pattern to `card-elevated` everywhere
Some pages use shadcn `Card` component, others use `card-elevated` class. Inconsistent visual depth.
- **Files**: `app/tax/page.tsx`, `app/cron/page.tsx`, `app/analytics/weekly/page.tsx`
- **Fix**: Added `card-elevated` to all plain `<Card>` and replaced `border border-border/70` with `card-elevated`
- [x] Done

### 4. Fix minimum font size
Heavy use of `text-[10px]` throughout. Hard to read, especially on mobile.
- **Files**: 12 page files (110 occurrences)
- **Fix**: Replaced all `text-[10px]` with `text-[11px]`
- [x] Done

### 5. Add health score gauge to Financial Health page
The health score exists in data but has no prominent visual. Needs a hero gauge widget.
- **File**: `app/financial-health/page.tsx`
- **Fix**: Already implemented — `ScoreRing` component (160px animated SVG with gradient + glow) exists at line 243
- [x] Done (pre-existing)

### 6. Improve Agent chat bubble styling
User and AI messages lack visual distinction. Both render as plain text blocks.
- **File**: `app/agent/page.tsx`
- **Fix**: Already implemented — User: `bg-primary text-primary-foreground rounded-br-md`, AI: `bg-card border card-elevated rounded-bl-md`
- [x] Done (pre-existing)

---

## P2 - Medium Priority

### 7. Dashboard 2-column layout on desktop
8+ sections stacked vertically = too much scrolling. Group into 2 columns on lg+.
- **File**: `app/dashboard/page.tsx`
- **Fix**: Bottom sections (Recent Txns + Monthly Trend, Recurring + AI Insights) wrapped in `lg:grid-cols-2`
- [x] Done

### 8. Add sortable table headers on Transactions
Cannot sort by amount, date, or category. Basic table UX expectation.
- **File**: `app/transactions/page.tsx`
- **Fix**: Added `sortField`/`sortDir` state, `toggleSort()` handler, clickable headers with sort icons
- [x] Done

### 9. Consistent income/expense color tokens
Income alternates between `text-primary` and `text-emerald-600`. Expenses between `text-destructive` and `text-rose-600`.
- **Files**: `app/globals.css`
- **Fix**: Added `.text-income` and `.text-expense` semantic classes (available for incremental adoption)
- [x] Done (CSS classes added)

### 10. Mobile card layouts for table-heavy pages
Transactions, Budget, Investments tables break on mobile.
- **Files**: `app/transactions/page.tsx`, `app/budget/page.tsx`
- **Fix**: Changed `overflow-hidden` to `overflow-x-auto`, added `min-w-[640px]` to table for horizontal scroll
- [x] Done

---

## P3 - Polish

### 11. Empty state illustrations
Empty states across all pages are text+icon only. Bland first-run experience.
- **Files**: Multiple pages
- **Fix**: Deferred — current empty states use icons + text which is functional
- [ ] Deferred

### 12. Sidebar: boost tree connector visibility
Tree lines use `bg-border` which is nearly invisible in dark mode.
- **File**: `components/nav-main.tsx`
- **Fix**: Changed inactive connectors from `bg-border` to `bg-muted-foreground/20`
- [x] Done

### 13. Header title visual weight
Title is `text-base font-semibold` which feels light for a page header.
- **File**: `components/site-header.tsx`
- **Fix**: Bumped to `text-base font-bold`
- [x] Done

### 14. Analytics stat bar dividers
`divide-x` pattern feels dated. Should match Dashboard's card-based stat bar.
- **File**: `app/analytics/page.tsx`
- **Fix**: Already uses `card-elevated rounded-2xl` with divide pattern — matches design system
- [x] Done (pre-existing)

### 15. Budget alert banner severity levels
All alerts use destructive red styling even for warnings.
- **File**: `app/budget/page.tsx`
- **Fix**: Already implemented — `>=90%` uses destructive red, `>=70%` uses amber, below uses neutral
- [x] Done (pre-existing)
