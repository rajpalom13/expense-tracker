# Sidebar Revert & Fixes Plan

> **For Claude:** Follow this document to implement all changes. Context may be compressed.

**Goal:** Revert from flat 6-item sidebar with tabs to grouped sidebar with sub-items (always expanded). Fix integration issues. QA everything.

---

## Task 1: Revert Sidebar to Grouped Sub-Items (Always Expanded)

**File:** `components/app-sidebar.tsx`

Restore grouped navigation with sub-items, but groups are ALWAYS expanded (no collapsible chevrons):

```
Dashboard                    → /dashboard

Overview
  Transactions               → /transactions
  Analytics                  → /analytics

Planning
  Budget                     → /budget
  Finance Planner            → /planner
  Tax Planner                → /tax

Wealth
  Investments                → /investments
  Financial Health           → /financial-health
  Goals                      → /goals
  Subscriptions              → /subscriptions

Intelligence
  AI Insights                → /ai-insights
  Finance Agent              → /agent
  Learn                      → /learn
```

- Group labels are just visual separators (not clickable, not collapsible)
- Each sub-item links directly to its own page
- All groups always visible, always expanded
- Keep user profile at bottom, logo at top

## Task 2: Remove Redirects from next.config.ts

**File:** `next.config.ts`

Remove ALL the redirects that were added (from /budget → /planning?tab=budget, etc.). Each page keeps its original URL.

## Task 3: Clean Up Tab Pages (but keep content components)

**Delete these files:**
- `app/planning/page.tsx` (consolidated tab page - no longer needed)
- `app/wealth/page.tsx` (consolidated tab page - no longer needed)
- `components/tab-page-layout.tsx` (tab layout component - no longer needed)

**Keep these files (useful for future):**
- `components/wealth/portfolio-content.tsx`
- `components/wealth/goals-content.tsx`
- `components/wealth/health-content.tsx`
- `components/wealth/income-goal-tracker.tsx`
- `components/planning/budget-suggestions.tsx`
- `components/notification-center.tsx`

**Revert these files** (remove the `standalone` prop pattern):
- `app/budget/page.tsx` - revert to original (remove BudgetContent export, standalone prop)
- `app/planner/page.tsx` - revert to original
- `app/tax/page.tsx` - revert to original

## Task 4: Place Income Goal Tracker on Goals Page

**File:** `app/goals/page.tsx`

Add `<IncomeGoalTracker />` as the first section on the Goals page, above the savings goals. Import from `components/wealth/income-goal-tracker.tsx`.

## Task 5: Fix Notification Bell Empty State

**File:** `components/notification-center.tsx`

When there are 0 notifications, show a helpful message instead of just "No notifications":
- Icon + "You're all caught up!"
- Subtitle: "Budget alerts, goal milestones, and weekly digests will appear here"
- Small text: "Notifications are generated automatically based on your financial activity"

## Task 6: Verify All Pages Work

Use Playwright to visit every page and confirm no 404s:
- /dashboard
- /transactions
- /analytics
- /budget
- /planner
- /tax
- /subscriptions
- /investments
- /financial-health
- /goals
- /ai-insights
- /agent
- /learn

## Task 7: Full QA Pass

Check with Playwright:
- Sidebar renders correctly on all pages
- Active state highlights correct item
- All charts render
- All data loads
- Notification bell works (shows empty state)
- Budget auto-tune button visible
- Income goal tracker visible on goals page
- No console errors (except known avatar 404)
- Dark theme consistent
