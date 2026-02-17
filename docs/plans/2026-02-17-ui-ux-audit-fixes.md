# UI/UX Audit Fixes - Complete Implementation Plan

> **For Claude:** Follow this document to implement all changes. QA every change with Playwright MCP.

**Goal:** Fix all redundancies, dead code, UX gaps, and UI polish issues found during the deep audit.

---

## Phase 1: Must Do (Cleanup)

### Task 1: Delete 5 Orphaned Content Components

These files were created during the tab consolidation attempt and are NOT imported anywhere.

**Delete:**
- `components/wealth/portfolio-content.tsx` (~2096 lines)
- `components/wealth/goals-content.tsx` (~2118 lines)
- `components/wealth/health-content.tsx` (~1822 lines)
- `components/intelligence/insights-content.tsx`
- `components/intelligence/agent-content.tsx`

**Keep (actively used):**
- `components/wealth/income-goal-tracker.tsx` (used in `app/goals/page.tsx`)
- `components/planning/budget-suggestions.tsx` (used in `app/budget/page.tsx`)
- `components/notification-center.tsx` (used in `components/site-header.tsx`)

**QA:** Run `npx tsc --noEmit` after deletion to confirm no broken imports.

### Task 2: Remove Standalone Prop Pattern from 3 Pages

**Files:** `app/budget/page.tsx`, `app/planner/page.tsx`, `app/tax/page.tsx`

Each file has a pattern like:
```tsx
export default function Page() {
  return <BudgetContent standalone />
}
export function BudgetContent({ standalone = false }: { standalone?: boolean }) {
  // ... all the page content
}
```

**Change to:** Remove the `BudgetContent`/`PlannerContent`/`TaxContent` named export wrapper. The default export should directly contain the page content (no `standalone` prop, no wrapper function, no "For embedded use" comments).

**QA:** Visit /budget, /planner, /tax with Playwright - verify they render identically.

### Task 3: Fix Avatar 404

**File:** `components/app-sidebar.tsx` (line 70) and `components/nav-user.tsx`

The `avatar: "/avatars/user.jpg"` path returns 404 on every page load.

**Fix:** Use an inline SVG fallback or just remove the avatar `src` so it always shows the "OR" fallback initials. The `AvatarFallback` already handles this, but the 404 fires on every page.

**Change:** Set `avatar: ""` in `app-sidebar.tsx` so `AvatarImage` doesn't attempt the fetch.

---

## Phase 2: Should Do (UX Polish)

### Task 4: Add Loading Skeletons to Key Pages

Multiple pages flash empty before data loads. Add shimmer/skeleton states to:

**Files to modify:**
- `app/goals/page.tsx` - Income Goal section and savings goals
- `app/ai-insights/page.tsx` - Show skeleton cards instead of "0/4 ready"
- `app/investments/page.tsx` - Portfolio summary area
- `app/financial-health/page.tsx` - Net worth and score sections

Use shadcn's `Skeleton` component (`components/ui/skeleton.tsx`). Pattern:
```tsx
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-full" />
  </div>
) : (
  // actual content
)}
```

**QA:** Visit each page with Playwright, verify skeletons appear briefly before data.

### Task 5: Add Suggested Prompts to Finance Agent

**File:** `app/agent/page.tsx`

When there's no active conversation (or on "+ New Chat"), show 4-6 suggested prompt chips above the input:
- "What are my top spending categories this month?"
- "Am I on track with my savings goals?"
- "How can I reduce my food spending?"
- "Give me a monthly financial summary"
- "What subscriptions should I review?"
- "How is my investment portfolio performing?"

Clicking a chip should populate the input and auto-submit.

**QA:** Visit /agent, click "+ New Chat", verify prompts appear and are clickable.

### Task 6: Make Income Goal Empty State Compact

**File:** `app/goals/page.tsx` (where `<IncomeGoalTracker />` is placed)

Currently the "No income goal set" empty state takes up ~200px of vertical space. Make it a slim banner:
- Single row: icon + "Track your income progress" + "Set Goal" button
- Height should be ~60px, not ~200px
- When a goal IS set, show the full tracker component

**QA:** Visit /goals, verify compact empty state renders.

### Task 7: Add Sticky Section Nav to Finance Planner

**File:** `app/planner/page.tsx`

The planner page requires ~4 full scrolls. Add a sticky section nav bar below the header with jump links:
- Income | Savings | Allocation | What-If | AI Analysis | Goals | Recommendations

Use `scroll-into-view` with smooth scrolling. Each section should have an `id` attribute.

**QA:** Visit /planner, verify sticky nav appears on scroll and clicking jumps to sections.

### Task 8: Move Subscriptions to Planning Group

**File:** `components/app-sidebar.tsx`

Move "Subscriptions" from the "Wealth" group to the "Planning" group. Subscriptions are recurring expenses, not wealth.

New sidebar structure:
```
Planning
  Budget
  Finance Planner
  Tax Planner
  Subscriptions      ← moved here

Wealth
  Investments
  Financial Health
  Goals
```

**QA:** Visit any page, verify sidebar shows Subscriptions under Planning.

### Task 9: Dashboard AI Insights Section - Better Formatting

**File:** `app/dashboard/page.tsx`

The AI Insights section at the bottom of Dashboard renders raw markdown text. Format it as:
- Health score as a small circular badge (like on /financial-health)
- Top categories as a compact horizontal list
- Action items as clickable chips that link to relevant pages
- "Generated" timestamp as subtle footer text

**QA:** Visit /dashboard, scroll to AI Insights, verify structured layout instead of raw text.

### Task 10: Personalize Learn Page

**File:** `app/learn/page.tsx`

Add a "Recommended for you" section at the top that highlights 2-3 lessons based on the user's actual financial data:
- If health score < 30 → recommend "Budgeting Methods", "Savings Rate"
- If no investments → recommend "What is Investing?", "SIP"
- If no emergency fund → recommend "Emergency Fund"

Fetch health score / investment data from existing API endpoints.

**QA:** Visit /learn, verify personalized recommendations appear at top.

---

## Phase 3: Nice to Have (Features)

### Task 11: Global Search (Ctrl+K)

**New file:** `components/command-palette.tsx`

Implement a command palette using shadcn's `Command` component (cmdk):
- Trigger: Ctrl+K or clicking a search icon in the header
- Search across: pages (all 13), transactions (by description), categories
- Show results grouped: "Pages", "Transactions", "Actions"
- Actions: "Add transaction", "Set budget", "Ask AI agent"

**Files to modify:**
- `components/site-header.tsx` - Add search icon button + Ctrl+K listener
- Create `components/command-palette.tsx`

**QA:** On any page, press Ctrl+K, verify palette opens. Type "budget", verify page link appears.

### Task 12: Quick Actions on Dashboard

**File:** `app/dashboard/page.tsx`

Add a quick actions row below the stat cards:
- "+ Add Transaction" → opens add transaction dialog or navigates to /transactions with ?add=true
- "Set Budget" → /budget
- "Ask AI" → /agent
- "Sync Data" → triggers sync

Use compact pill buttons with icons.

**QA:** Visit /dashboard, verify quick action buttons appear and navigate correctly.

### Task 13: Transaction Detail View (Clickable Rows)

**File:** `app/transactions/page.tsx`

Make transaction rows clickable. On click, open a slide-over sheet showing:
- Full description (untruncated)
- Category with change option
- Amount, date, method
- Similar transactions
- "Mark as recurring" toggle

**QA:** Visit /transactions, click a row, verify detail sheet opens.

### Task 14: Analytics Export

**File:** `app/analytics/page.tsx`

Add an export button in the header area. Options:
- "Download CSV" - export current view's data as CSV
- "Download PDF" - export current view as formatted PDF (use browser print)

**QA:** Visit /analytics, click export, verify CSV downloads.

### Task 15: Spending Breakdown - Show All Categories

**File:** `app/dashboard/page.tsx`

The spending breakdown shows 6 categories with "+2 more categories" text. Replace with:
- Show all categories (remove the limit)
- Or add a "Show all" button that expands the list

**QA:** Visit /dashboard, verify all 8 categories visible.

### Task 16: Financial Health Score - Add CTAs

**File:** `app/financial-health/page.tsx`

Below the health score, add contextual action buttons based on score:
- If score < 30: "Review Budget →", "Set Savings Goal →", "Talk to AI Agent →"
- If score < 60: "Optimize Budget →", "Increase Investments →"
- Link buttons to relevant pages.

Also add a link from Emergency Fund section to /goals.

**QA:** Visit /financial-health, verify action buttons appear below score.

### Task 17: Header Consistency

**Files:** All page files under `app/*/page.tsx`

Standardize the header area across all pages. Every page should have:
- Page title + subtitle
- Notification bell (already present via site-header)
- Theme toggle (already present)

Remove inconsistencies:
- "Sync" button only on Dashboard → keep it there (it's dashboard-specific)
- Date picker on Analytics/Tax → keep (page-specific controls)

No changes needed here, this is already consistent. Just confirming.

---

## Execution Order

1. **Wave 1 (Cleanup):** Tasks 1, 2, 3 - parallel
2. **Wave 2 (UX Polish):** Tasks 4, 5, 6, 8 - parallel
3. **Wave 3 (UX Polish):** Tasks 7, 9, 10 - parallel
4. **Wave 4 (Features):** Tasks 11, 12, 15, 16 - parallel
5. **Wave 5 (Features):** Tasks 13, 14 - parallel
6. **Final QA:** Full Playwright pass of all 13 pages
