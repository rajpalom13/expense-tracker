# Finance Tracker V2 - Complete Enhancement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the finance tracker from a backward-looking expense tracker into a forward-looking income growth engine with consolidated navigation, personalized AI coaching, and complete net worth tracking.

**Architecture:** Consolidate 12 sidebar pages into 6 by merging related pages with tabs. Add new features as tabs/sections within existing consolidated pages. All new data goes to MongoDB Atlas. Inngest handles automated workflows (weekly digests, price updates, AI nudges). OpenRouter Claude Sonnet 4.5 powers all AI personalization.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, MongoDB Atlas, Inngest, shadcn/ui, Recharts, OpenRouter AI, TanStack Query

---

## Phase 0: Sidebar Consolidation & Navigation Overhaul

### Current Sidebar (12 items, 4 groups)
```
Overview:      Dashboard, Transactions
Planning:      Analytics, Budget, Finance Planner, Tax Planner, Subscriptions
Wealth:        Investments, Financial Health, Goals
Intelligence:  AI Insights, Finance Agent, Learn
```

### New Sidebar (6 items, clean flat list)
```
Dashboard          /dashboard          (home overview - unchanged)
Transactions       /transactions       (tabs: All | Recurring | Subscriptions)
Planning           /planning           (tabs: Budget | Planner | Tax)
Analytics          /analytics          (tabs: Daily | Weekly | Monthly | Comparison | Trends | Yearly)
Wealth             /wealth             (tabs: Portfolio | Goals & FIRE | Health Score)
Intelligence       /intelligence       (tabs: Insights | Agent | Learn)
```

### What gets merged:
| Old Page | New Location | How |
|----------|-------------|-----|
| `/transactions` | `/transactions` (All tab) | Keep as default tab |
| `/subscriptions` | `/transactions` (Subscriptions tab) | Move subscription content |
| `/budget` | `/planning` (Budget tab) | Move budget content |
| `/planner` | `/planning` (Planner tab) | Move planner content |
| `/tax` | `/planning` (Tax tab) | Move tax content |
| `/analytics` | `/analytics` | Keep (already has tabs) |
| `/investments` | `/wealth` (Portfolio tab) | Move investments content |
| `/goals` | `/wealth` (Goals & FIRE tab) | Move goals content |
| `/financial-health` | `/wealth` (Health Score tab) | Move health content |
| `/ai-insights` | `/intelligence` (Insights tab) | Move insights content |
| `/agent` | `/intelligence` (Agent tab) | Move agent content |
| `/learn` | `/intelligence` (Learn tab) | Move learn content |

### URL Redirect Strategy
Old URLs redirect to new tab locations via Next.js redirects in `next.config.ts`:
- `/subscriptions` → `/transactions?tab=subscriptions`
- `/budget` → `/planning?tab=budget`
- `/planner` → `/planning?tab=planner`
- `/tax` → `/planning?tab=tax`
- `/investments` → `/wealth?tab=portfolio`
- `/goals` → `/wealth?tab=goals`
- `/financial-health` → `/wealth?tab=health`
- `/ai-insights` → `/intelligence?tab=insights`
- `/agent` → `/intelligence?tab=agent`
- `/learn` → `/intelligence?tab=learn`

---

## Phase 1: Sidebar Consolidation (Task 1-6)

### Task 1: Create Shared Tab Layout Component

**Files:**
- Create: `components/tab-page-layout.tsx`

**What:** A reusable layout component that reads `?tab=xxx` from URL params and renders the correct tab. All consolidated pages will use this.

```tsx
// components/tab-page-layout.tsx
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Suspense } from "react"

interface TabConfig {
  value: string
  label: string
  icon?: React.ReactNode
  content: React.ReactNode
}

interface TabPageLayoutProps {
  tabs: TabConfig[]
  defaultTab: string
}

function TabPageInner({ tabs, defaultTab }: TabPageLayoutProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get("tab") || defaultTab

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function TabPageLayout(props: TabPageLayoutProps) {
  return (
    <Suspense fallback={null}>
      <TabPageInner {...props} />
    </Suspense>
  )
}
```

---

### Task 2: Create Consolidated Transactions Page

**Files:**
- Create: `app/transactions-v2/page.tsx` (initially, then swap)
- Reuse: Content from `app/transactions/page.tsx`
- Reuse: Content from `app/subscriptions/page.tsx`

**Tabs:**
1. **All** - Current transactions page content (default)
2. **Recurring** - Filter to show only recurring transactions
3. **Subscriptions** - Current subscriptions page content

**Implementation:** Extract the main content from each existing page into standalone components (e.g., `components/transactions/transactions-content.tsx`, `components/transactions/subscriptions-content.tsx`), then compose them in the new tabbed page.

---

### Task 3: Create Consolidated Planning Page

**Files:**
- Create: `app/planning/page.tsx`
- Extract: `components/planning/budget-content.tsx` from `app/budget/page.tsx`
- Extract: `components/planning/planner-content.tsx` from `app/planner/page.tsx`
- Extract: `components/planning/tax-content.tsx` from `app/tax/page.tsx`

**Tabs:**
1. **Budget** - Current budget page content (default)
2. **Planner** - Current finance planner content
3. **Tax** - Current tax planner content

---

### Task 4: Create Consolidated Wealth Page

**Files:**
- Create: `app/wealth/page.tsx`
- Extract: `components/wealth/portfolio-content.tsx` from `app/investments/page.tsx`
- Extract: `components/wealth/goals-content.tsx` from `app/goals/page.tsx`
- Extract: `components/wealth/health-content.tsx` from `app/financial-health/page.tsx`

**Tabs:**
1. **Portfolio** - Current investments page content (default)
2. **Goals & FIRE** - Current goals page with all sub-tabs
3. **Health Score** - Current financial health content

---

### Task 5: Create Consolidated Intelligence Page

**Files:**
- Create: `app/intelligence/page.tsx`
- Extract: `components/intelligence/insights-content.tsx` from `app/ai-insights/page.tsx`
- Extract: `components/intelligence/agent-content.tsx` from `app/agent/page.tsx`
- Extract: `components/intelligence/learn-content.tsx` from `app/learn/page.tsx`

**Tabs:**
1. **Insights** - Current AI insights content (default)
2. **Agent** - Current finance agent chat
3. **Learn** - Current learn content (will be enhanced in Phase 2)

---

### Task 6: Update Sidebar & Add Redirects

**Files:**
- Modify: `components/app-sidebar.tsx` - New 6-item navigation
- Modify: `next.config.ts` - Add redirects from old URLs

**New Sidebar Structure:**
```tsx
const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconLayoutDashboard,
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: IconReceipt,
  },
  {
    title: "Planning",
    url: "/planning",
    icon: IconCalendarStats,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: IconChartBar,
  },
  {
    title: "Wealth",
    url: "/wealth",
    icon: IconBuildingBank,
  },
  {
    title: "Intelligence",
    url: "/intelligence",
    icon: IconSparkles,
  },
]
```

No groups/collapsibles - just 6 flat items. Clean, scannable, no cognitive overhead.

---

## Phase 2: New Features (Tasks 7-18)

### Task 7: Income Goal Tracker

**Location:** Wealth page → Goals & FIRE tab (new section at top)

**Files:**
- Create: `app/api/income-goals/route.ts`
- Create: `components/wealth/income-goal-tracker.tsx`
- Create: `lib/income-goals.ts`

**MongoDB Collection:** `income_goals`
```json
{
  "userId": "string",
  "targetAmount": 1000000,       // Annual target (e.g., 10L for six figures)
  "currency": "INR",
  "targetDate": "2026-12-31",
  "sources": [
    { "name": "Salary", "expected": 75000, "frequency": "monthly" },
    { "name": "Freelance", "expected": 20000, "frequency": "monthly" },
    { "name": "Investments", "expected": 5000, "frequency": "monthly" }
  ],
  "createdAt": "date",
  "updatedAt": "date"
}
```

**API Routes:**
- `GET /api/income-goals` - Fetch income goal + progress (calculates from transactions)
- `POST /api/income-goals` - Create/update income goal
- `DELETE /api/income-goals` - Delete income goal

**UI Component:** `income-goal-tracker.tsx`
- Hero section: "₹X / ₹10,00,000" with large progress ring
- Income source breakdown (auto-detected from transaction categories)
- Month-over-month income growth rate chart
- Gap analysis: "Need ₹X more per month to hit target by [date]"
- Track actual vs expected per source

**How it calculates progress:**
- Sums all `type: "income"` transactions from current fiscal year
- Groups by source using categorization rules
- Compares to target → shows % progress, projected year-end

---

### Task 8: Personalized Learn Tab (AI-Powered)

**Location:** Intelligence page → Learn tab (replaces static content)

**Files:**
- Modify: `app/learn/page.tsx` → `components/intelligence/learn-content.tsx`
- Create: `app/api/learn/recommendations/route.ts`
- Create: `lib/learn-personalization.ts`

**How it works:**
1. On page load, fetch user's financial health data (health score, emergency fund, savings rate, investment rate)
2. Call AI with user's metrics to generate personalized topic recommendations
3. Prepend a "Recommended for You" section above existing static content
4. Each recommendation links to the relevant static topic AND the relevant app page

**API Route:** `GET /api/learn/recommendations`
```typescript
// Fetches user metrics, calls AI to rank topics
// Returns: [{ topicId, reason, priority, actionUrl }]
// Example: { topicId: "emergency-fund", reason: "You have 0.3 months coverage (target: 6)", priority: "critical", actionUrl: "/wealth?tab=health" }
```

**UI Changes to Learn:**
- New "Recommended for You" banner at top with 3 AI-picked topics
- Each topic card gets a "Take Action" button linking to relevant page
- Badge: "Based on your Health Score: 10/100"
- Keep all existing static content below (it's good reference material)

---

### Task 9: Budget Auto-Tuning

**Location:** Planning page → Budget tab (new feature)

**Files:**
- Create: `app/api/budgets/suggest/route.ts`
- Create: `components/planning/budget-suggestions.tsx`

**API Route:** `GET /api/budgets/suggest`
```typescript
// Calculates 3-month average spend per category
// Returns suggested budget per category
// Example: { "Shopping": { current: 3000, suggested: 50000, avg3mo: 87000, reason: "3-month avg is ₹87K" } }
```

**UI:** Button "Auto-tune Budgets" on budget page
- Shows modal with current vs suggested side-by-side
- User can accept/reject per category
- One-click "Apply All Suggestions"
- Explains reasoning: "Based on your last 3 months, you average ₹X on [category]"

---

### Task 10: Proactive AI Notifications

**Files:**
- Create: `app/api/notifications/route.ts`
- Create: `lib/notifications.ts`
- Create: `components/notification-center.tsx`
- Modify: `lib/inngest.ts` - Add weekly digest workflow
- Create: `app/api/inngest/route.ts` - Register new Inngest functions

**MongoDB Collection:** `notifications`
```json
{
  "userId": "string",
  "type": "budget_breach|goal_milestone|weekly_digest|sip_reminder|renewal_alert|insight",
  "title": "Shopping budget exceeded",
  "message": "You've spent ₹87K on Shopping vs ₹3K budget",
  "severity": "critical|warning|info|success",
  "read": false,
  "actionUrl": "/planning?tab=budget",
  "createdAt": "date"
}
```

**Inngest Workflows:**
1. **Weekly Digest** (every Sunday 9am): Summarize week's spending, savings, portfolio change. Generate via AI. Store as notification.
2. **Budget Breach Check** (daily): Compare spend vs budget per category. Alert at 80% and 100%.
3. **Goal Progress** (weekly): Check savings goals progress, celebrate milestones.
4. **Subscription Renewals** (daily): Check upcoming renewals within 3 days.

**UI:** Bell icon in site header with notification dropdown
- Unread count badge
- Click to expand notification center (slide-over panel)
- Mark as read / dismiss
- "View All" link

---

### Task 11: FD/PPF/NPS/EPF Tracking

**Location:** Wealth page → Portfolio tab (new sub-sections)

**Files:**
- Create: `app/api/fixed-deposits/route.ts`
- Create: `app/api/ppf/route.ts`
- Create: `app/api/other-investments/route.ts`
- Create: `components/wealth/fixed-deposits.tsx`
- Create: `components/wealth/ppf-tracker.tsx`
- Create: `components/wealth/other-investments.tsx`

**MongoDB Collections:**

`fixed_deposits`:
```json
{
  "userId": "string",
  "bank": "SBI",
  "amount": 100000,
  "rate": 7.1,
  "startDate": "2025-01-01",
  "maturityDate": "2026-01-01",
  "maturityAmount": 107100,
  "autoRenew": true,
  "status": "active|matured|broken"
}
```

`ppf_accounts`:
```json
{
  "userId": "string",
  "accountNumber": "xxx",
  "balance": 150000,
  "yearlyContributions": [
    { "fy": "2025-26", "amount": 50000 }
  ],
  "interestRate": 7.1,
  "maturityDate": "2040-01-01"
}
```

`other_investments` (NPS, EPF, gold, real estate, crypto):
```json
{
  "userId": "string",
  "type": "nps|epf|gold|real_estate|crypto",
  "name": "NPS Tier 1",
  "currentValue": 200000,
  "investedAmount": 180000,
  "metadata": {},   // Type-specific fields
  "lastUpdated": "date"
}
```

**UI in Portfolio tab:**
- Existing stocks/MF/SIP content stays at top
- New sections below: "Fixed Deposits", "PPF", "Other Assets"
- Each with add/edit/delete
- All feed into the net worth calculation on Health Score tab

---

### Task 12: Side Income / Freelance Tracker

**Location:** Dashboard (new section) + Transactions page (Income tab)

**Files:**
- Create: `app/api/income-sources/route.ts`
- Create: `components/dashboard/income-tracker-widget.tsx`
- Create: `components/transactions/income-content.tsx`

**MongoDB Collection:** `income_sources`
```json
{
  "userId": "string",
  "name": "Freelance Web Dev",
  "type": "freelance|salary|business|investment|rental|other",
  "client": "Acme Corp",
  "amount": 25000,
  "status": "expected|received|overdue",
  "expectedDate": "2026-02-28",
  "receivedDate": null,
  "invoiceRef": "INV-001",
  "recurring": false,
  "notes": ""
}
```

**UI:**
- Transactions page gets 4th tab: "Income"
- Shows income sources, expected vs received, overdue invoices
- Dashboard widget: mini income breakdown for current month

---

### Task 13: Cash Flow Forecasting

**Location:** Dashboard (enhanced cashflow section)

**Files:**
- Create: `lib/cashflow-forecast.ts`
- Modify: Dashboard cashflow forecast section

**Algorithm:**
1. Detect recurring expenses from last 3 months (using `lib/recurring.ts`)
2. Detect recurring income (salary pattern, freelance patterns)
3. Add known upcoming: subscription renewals, SIP debits, EMIs
4. Project next 30/60/90 days
5. Show: "Projected balance on [date]: ₹X"

**UI:** Expand existing "Cashflow Forecast" card on dashboard
- Add toggle: "This Month" | "Next 3 Months"
- Area chart showing projected balance over time
- Flags for known upcoming expenses (SIPs, subs, EMIs)

---

### Task 14: Debt Payoff Strategy

**Location:** Wealth page → Health Score tab (expand existing debt tracker)

**Files:**
- Create: `lib/debt-strategy.ts`
- Create: `components/wealth/debt-strategy.tsx`
- Modify: `components/wealth/health-content.tsx`

**Features:**
- Snowball vs Avalanche comparison
- "Pay ₹X extra on [loan] to save ₹Y in interest"
- Debt-free date projection chart
- Total interest cost visualization
- One-click "Optimal payoff order" generator

---

### Task 15: Financial Scenarios (Expanded What-If)

**Location:** Planning page → Planner tab (enhance existing what-if simulator)

**Files:**
- Create: `components/planning/scenario-simulator.tsx`
- Modify: Planner content component

**New scenarios beyond budget allocation:**
- "What if my income increases to ₹X?" → Recalculate savings rate, FIRE timeline
- "What if I buy a house for ₹XL?" → EMI impact, net worth change
- "What if I start investing ₹X more in SIPs?" → 10Y projection change
- "What if I switch jobs to ₹X salary?" → Tax impact, savings change

Each scenario:
1. User inputs the change
2. System recalculates all metrics (savings rate, FIRE years, net worth projection)
3. Shows before/after comparison side-by-side

---

### Task 16: Enhanced Net Worth Dashboard

**Location:** Wealth page → Health Score tab (top section)

**Files:**
- Modify: `components/wealth/health-content.tsx`
- Modify: `lib/financial-health.ts`
- Modify: `app/api/financial-health/route.ts`

**Enhancement:** Pull data from ALL investment collections:
- Bank balance (from transactions)
- Stocks (from `stocks` collection)
- Mutual Funds (from `mutual_funds`)
- Fixed Deposits (from `fixed_deposits` - NEW)
- PPF (from `ppf_accounts` - NEW)
- Other Investments (from `other_investments` - NEW)
- Subtract: Debts (from `debts`)

**New UI:**
- Stacked bar showing composition: Bank | Equity | Debt | Gold | Real Estate
- Net worth trend over 12 months
- Asset allocation pie chart (across ALL asset types, not just stocks/MFs)
- Liability breakdown
- True net worth = Total Assets - Total Liabilities

---

### Task 17: Notification Center UI

**Location:** Site header (global)

**Files:**
- Modify: `components/site-header.tsx` - Add bell icon
- Create: `components/notification-center.tsx` - Slide-over panel
- Create: `hooks/use-notifications.ts` - Notification fetching hook

**UI:**
- Bell icon with unread count badge in header (next to Sync button)
- Click opens slide-over panel from right
- Grouped by date (Today, Yesterday, This Week, Earlier)
- Each notification: icon, title, message, time, action button
- Mark all as read
- Severity-based coloring (red/yellow/green/blue)

---

### Task 18: Inngest Workflow Registration

**Files:**
- Modify: `lib/inngest.ts` - Add new workflow functions
- Modify: `app/api/inngest/route.ts` - Register new functions

**New Inngest Functions:**
1. `finance/weekly.digest` - Cron: "0 9 * * 0" (Sunday 9am)
2. `finance/budget.check` - Cron: "0 20 * * *" (daily 8pm)
3. `finance/goal.progress` - Cron: "0 9 * * 1" (Monday 9am)
4. `finance/renewal.alert` - Cron: "0 9 * * *" (daily 9am)

Each generates notifications → stores in `notifications` collection.

---

## Phase 3: Polish & Integration (Tasks 19-21)

### Task 19: Update Dashboard with New Widgets

**Files:**
- Modify: `app/dashboard/page.tsx`

**New sections:**
- Income goal progress bar (from Task 7)
- Side income tracker widget (from Task 12)
- Enhanced cashflow forecast with 3-month toggle (from Task 13)
- Notification summary ("3 unread notifications")
- Quick-action cards: "Set income goal", "Tune budgets", "Review AI insights"

---

### Task 20: Mobile Responsiveness Pass

**Files:**
- All new components

**Checklist:**
- Tab bars scroll horizontally on mobile
- Cards stack vertically
- Charts resize properly
- Agent chat works on mobile
- Notification center is full-screen on mobile

---

### Task 21: Old Page Cleanup

**Files:**
- Delete: `app/subscriptions/page.tsx` (moved to transactions)
- Delete: `app/budget/page.tsx` (moved to planning)
- Delete: `app/planner/page.tsx` (moved to planning)
- Delete: `app/tax/page.tsx` (moved to planning)
- Delete: `app/investments/page.tsx` (moved to wealth)
- Delete: `app/goals/page.tsx` (moved to wealth)
- Delete: `app/financial-health/page.tsx` (moved to wealth)
- Delete: `app/ai-insights/page.tsx` (moved to intelligence)
- Delete: `app/agent/page.tsx` (moved to intelligence)
- Delete: `app/learn/page.tsx` (moved to intelligence)
- Keep old routes with redirects in `next.config.ts`

---

## Implementation Priority & Parallelization

### Wave 1 (Can run in parallel - no dependencies):
- **Agent A:** Task 1 (Tab Layout Component) + Task 6 (Sidebar Update)
- **Agent B:** Task 7 (Income Goal Tracker - API + component)
- **Agent C:** Task 9 (Budget Auto-Tuning)
- **Agent D:** Task 10 (Notifications - API + Inngest workflows)

### Wave 2 (After Wave 1 tab component is ready):
- **Agent E:** Tasks 2-5 (Page Consolidation - Transactions, Planning, Wealth, Intelligence)
- **Agent F:** Task 8 (Personalized Learn)
- **Agent G:** Task 11 (FD/PPF/NPS tracking)
- **Agent H:** Task 12 (Side Income Tracker)

### Wave 3 (Integration & Polish):
- **Agent I:** Tasks 13-15 (Cash Flow, Debt Strategy, Scenarios)
- **Agent J:** Task 16-17 (Enhanced Net Worth + Notification UI)
- **Agent K:** Tasks 18-21 (Inngest registration, Dashboard, Mobile, Cleanup)

---

## MongoDB Collections Summary (New)

| Collection | Purpose | Phase |
|-----------|---------|-------|
| `income_goals` | Annual income target + sources | Phase 2 |
| `notifications` | AI nudges, alerts, digests | Phase 2 |
| `fixed_deposits` | FD tracking | Phase 2 |
| `ppf_accounts` | PPF balance + contributions | Phase 2 |
| `other_investments` | NPS, EPF, gold, real estate, crypto | Phase 2 |
| `income_sources` | Freelance/side income tracking | Phase 2 |

**Existing collections unchanged:** transactions, stocks, mutual_funds, sips, stock_transactions, mutual_fund_transactions, budget_categories, categorization_rules, cron_runs, ai_analyses, users, debts, savings_goals, subscriptions

---

## Success Metrics

After implementation:
- Sidebar: 6 items (down from 12) - 50% reduction
- New features: 12 major additions
- Net worth tracking: Complete (bank + equity + debt + gold + RE + crypto)
- AI personalization: Learn tab, notifications, budget tuning
- Income tracking: Goal + source breakdown + growth rate
- Forward-looking: Cash flow forecast, FIRE timeline, scenario simulator
- Automated: Weekly digest, budget alerts, renewal reminders via Inngest
