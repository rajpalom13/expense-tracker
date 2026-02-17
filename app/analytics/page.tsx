"use client"

import * as React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconScale,
  IconWallet,
  IconCalendarStats,
  IconReceipt2,
  IconCalendar,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowsExchange,
  IconChartLine,
} from "@tabler/icons-react"

import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import {
  calculateAnalytics,
  calculateCategoryBreakdown,
  calculateDailyTrends,
  calculateMonthlyTrends,
  calculateYearOverYearGrowth,
  separateOneTimeExpenses,
} from "@/lib/analytics"
import {
  getAvailableMonths,
  getCurrentMonth,
  calculateMonthlyMetrics,
  getMonthTransactions,
  getPreviousMonth,
  MonthIdentifier,
} from "@/lib/monthly-utils"
import { calculateBalanceTrend } from "@/lib/balance-utils"
import { isCompletedStatus, toDate } from "@/lib/utils"
import { stagger, fadeUp, fadeUpSmall, numberPop } from "@/lib/motion"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MonthSelector } from "@/components/month-selector"
import { MonthlySummaryCard } from "@/components/monthly-summary-card"
import { WeeklyAnalyticsContent } from "@/components/weekly-analytics-content"
import { CategoryChart } from "@/components/category-chart"
import { PaymentMethodChart } from "@/components/payment-method-chart"
import { SpendingComparison } from "@/components/spending-comparison"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { InfoTooltip } from "@/components/info-tooltip"
import { formatINR as formatCurrency, formatCompactAxis } from "@/lib/format"

// Chart colors using CSS variables (oklch values resolve in SVG)
const CHART_INCOME = "var(--chart-1)"
const CHART_EXPENSE = "var(--chart-5)"

// Trend chart color palette for categories (CSS vars for first 5, then fallback)
const TREND_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)", "var(--primary)", "var(--accent-foreground)"]

// Custom tooltip component for all charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground capitalize">{entry.dataKey}:</span>
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Comparison tooltip shows name instead of raw dataKey
function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.name}:</span>
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Chart legend rendered below each chart
function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/30">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// Clickable legend for trend chart with toggle
function TrendLegend({
  categories,
  visibleCategories,
  onToggle,
}: {
  categories: { name: string; color: string }[]
  visibleCategories: Set<string>
  onToggle: (cat: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-border/30">
      {categories.map((cat) => {
        const isVisible = visibleCategories.has(cat.name)
        return (
          <button
            key={cat.name}
            onClick={() => onToggle(cat.name)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all ${
              isVisible
                ? "text-foreground bg-muted/50"
                : "text-muted-foreground/40 line-through"
            }`}
          >
            <div
              className="size-2 rounded-full transition-opacity"
              style={{
                backgroundColor: cat.color,
                opacity: isVisible ? 1 : 0.3,
              }}
            />
            <span className="font-medium">{cat.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { transactions, isLoading: transactionsLoading } = useTransactions()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  const availableMonths = React.useMemo(
    () => getAvailableMonths(transactions),
    [transactions]
  )
  const [selectedMonth, setSelectedMonth] = React.useState<MonthIdentifier>(
    availableMonths.length > 0
      ? availableMonths[availableMonths.length - 1]
      : getCurrentMonth()
  )

  React.useEffect(() => {
    if (availableMonths.length > 0) {
      const current = availableMonths.find(
        (m) => m.year === selectedMonth.year && m.month === selectedMonth.month
      )
      if (!current) {
        setSelectedMonth(availableMonths[availableMonths.length - 1])
      }
    }
  }, [availableMonths, selectedMonth])

  const monthTransactions = React.useMemo(
    () =>
      getMonthTransactions(
        transactions,
        selectedMonth.year,
        selectedMonth.month
      ),
    [transactions, selectedMonth]
  )

  const monthlyMetrics = React.useMemo(
    () =>
      calculateMonthlyMetrics(
        transactions,
        selectedMonth.year,
        selectedMonth.month
      ),
    [transactions, selectedMonth]
  )

  const [excludeOneTime, setExcludeOneTime] = React.useState(false)

  const separatedExpenses = React.useMemo(
    () => separateOneTimeExpenses(monthTransactions),
    [monthTransactions]
  )

  const effectiveTransactions = React.useMemo(() => {
    if (!excludeOneTime) return monthTransactions
    const oneTimeIds = new Set(separatedExpenses.oneTime.map((t) => t.id))
    return monthTransactions.filter((t) => !oneTimeIds.has(t.id))
  }, [monthTransactions, excludeOneTime, separatedExpenses])

  const analytics = effectiveTransactions.length > 0
    ? calculateAnalytics(effectiveTransactions)
    : null
  const monthlyTrends = calculateMonthlyTrends(transactions)
  const dailyTrends = calculateDailyTrends(effectiveTransactions)
  const categoryBreakdown = calculateCategoryBreakdown(effectiveTransactions)
  const balanceTrend = calculateBalanceTrend(monthTransactions)
  const showBalanceTrendDots = balanceTrend.length <= 1
  const hasOneTimeExpenses = separatedExpenses.oneTime.length > 0

  // ── Month-over-Month Comparison Data ──
  const previousMonth = React.useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth])

  const prevMonthTransactions = React.useMemo(
    () => getMonthTransactions(transactions, previousMonth.year, previousMonth.month),
    [transactions, previousMonth]
  )

  const prevCategoryBreakdown = React.useMemo(
    () => calculateCategoryBreakdown(prevMonthTransactions),
    [prevMonthTransactions]
  )

  const prevMonthlyMetrics = React.useMemo(
    () => calculateMonthlyMetrics(transactions, previousMonth.year, previousMonth.month),
    [transactions, previousMonth]
  )

  const comparisonData = React.useMemo(() => {
    // Merge current and previous category breakdowns
    const catMap = new Map<string, { current: number; previous: number }>()

    for (const cat of categoryBreakdown) {
      const existing = catMap.get(cat.category) || { current: 0, previous: 0 }
      existing.current = cat.amount
      catMap.set(cat.category, existing)
    }
    for (const cat of prevCategoryBreakdown) {
      const existing = catMap.get(cat.category) || { current: 0, previous: 0 }
      existing.previous = cat.amount
      catMap.set(cat.category, existing)
    }

    return Array.from(catMap.entries())
      .map(([category, values]) => ({
        category,
        current: values.current,
        previous: values.previous,
      }))
      .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous))
      .slice(0, 10) // top 10 categories
  }, [categoryBreakdown, prevCategoryBreakdown])

  const comparisonChanges = React.useMemo(() => {
    const curIncome = monthlyMetrics?.totalIncome || 0
    const prevIncome = prevMonthlyMetrics?.totalIncome || 0
    const curExpense = monthlyMetrics?.totalExpenses || 0
    const prevExpense = prevMonthlyMetrics?.totalExpenses || 0
    const curSavings = curIncome - curExpense
    const prevSavings = prevIncome - prevExpense

    const pctChange = (cur: number, prev: number) =>
      prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0

    return {
      income: { current: curIncome, previous: prevIncome, change: pctChange(curIncome, prevIncome) },
      expense: { current: curExpense, previous: prevExpense, change: pctChange(curExpense, prevExpense) },
      savings: { current: curSavings, previous: prevSavings, change: pctChange(curSavings, prevSavings) },
    }
  }, [monthlyMetrics, prevMonthlyMetrics])

  // Category-level top changes for badges
  const topCategoryChanges = React.useMemo(() => {
    return comparisonData
      .filter((d) => d.previous > 0) // only compare where we have previous data
      .map((d) => ({
        category: d.category,
        change: ((d.current - d.previous) / d.previous) * 100,
        current: d.current,
        previous: d.previous,
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5)
  }, [comparisonData])

  // ── Category Trend Over Time (last 6 months) ──
  const { trendData, trendCategories } = React.useMemo(() => {
    // Get last 6 months
    const months: MonthIdentifier[] = []
    let m = { ...selectedMonth }
    for (let i = 0; i < 6; i++) {
      months.unshift(m)
      m = getPreviousMonth(m)
    }

    // For each month, compute per-category expense breakdown
    const allCategories = new Set<string>()
    const monthlyData: Record<string, Record<string, number>> = {}

    for (const month of months) {
      const key = month.label.split(" ").map((p, i) => i === 0 ? p.substring(0, 3) : p).join(" ")
      const txns = getMonthTransactions(transactions, month.year, month.month)
      const breakdown = calculateCategoryBreakdown(txns)
      const row: Record<string, number> = { month: 0 } // placeholder - month will be replaced by the label
      for (const cat of breakdown) {
        row[cat.category] = cat.amount
        allCategories.add(cat.category)
      }
      monthlyData[key] = row
    }

    // Determine top 5 categories by total spending across all months
    const categoryTotals = new Map<string, number>()
    for (const cat of allCategories) {
      let total = 0
      for (const monthRow of Object.values(monthlyData)) {
        total += monthRow[cat] || 0
      }
      categoryTotals.set(cat, total)
    }
    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)

    // Build chart data array
    const data = Object.entries(monthlyData).map(([monthLabel, values]) => {
      const row: Record<string, any> = { month: monthLabel }
      for (const cat of topCategories) {
        row[cat] = values[cat] || 0
      }
      return row
    })

    return {
      trendData: data,
      trendCategories: topCategories,
    }
  }, [transactions, selectedMonth])

  const [visibleTrendCategories, setVisibleTrendCategories] = React.useState<Set<string>>(
    new Set<string>()
  )

  // Initialize visible categories when trend data changes
  React.useEffect(() => {
    if (trendCategories.length > 0) {
      setVisibleTrendCategories(new Set(trendCategories.slice(0, 5)))
    }
  }, [trendCategories])

  const toggleTrendCategory = React.useCallback((cat: string) => {
    setVisibleTrendCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }, [])

  // ── Existing yearly data ──
  const yearlyData = React.useMemo(() => {
    const map = new Map<number, { income: number; expenses: number }>()
    const completed = transactions.filter((t) => isCompletedStatus(t.status))
    completed.forEach((t) => {
      const year = toDate(t.date).getFullYear()
      const entry = map.get(year) || { income: 0, expenses: 0 }
      if (t.type === "income") entry.income += t.amount
      if (t.type === "expense") entry.expenses += t.amount
      map.set(year, entry)
    })
    const currentYear = new Date().getFullYear()
    if (!map.has(currentYear)) {
      map.set(currentYear, { income: 0, expenses: 0 })
    }
    if (!map.has(currentYear - 1)) {
      map.set(currentYear - 1, { income: 0, expenses: 0 })
    }
    return Array.from(map.entries())
      .map(([year, values]) => ({
        year,
        income: values.income,
        expenses: values.expenses,
        savings: values.income - values.expenses,
      }))
      .sort((a, b) => a.year - b.year)
  }, [transactions])
  const showYearlyDots = yearlyData.length <= 1

  const currentYear = new Date().getFullYear()
  const yoyGrowth = calculateYearOverYearGrowth(transactions, currentYear)

  const totalIncome = analytics?.totalIncome || 0
  const totalExpenses = analytics?.totalExpenses || 0
  const openingBalance = monthlyMetrics?.openingBalance || 0
  const closingBalance = monthlyMetrics?.closingBalance || 0
  const netChange = monthlyMetrics?.netChange || 0

  const isLoading = authLoading || transactionsLoading

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="Analytics"
          subtitle="Insights across daily, weekly, monthly, and yearly views"
          actions={
            availableMonths.length > 0 ? (
              <MonthSelector
                availableMonths={availableMonths}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />
            ) : null
          }
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4">
            {isLoading ? (
              <AnalyticsLoadingSkeleton />
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
                {/* ── Stat Bar ── */}
                <motion.div
                  variants={fadeUp}
                  className="card-elevated rounded-2xl bg-card grid grid-cols-2 @xl/main:grid-cols-4 divide-y @xl/main:divide-y-0 @xl/main:divide-x divide-border/40"
                >
                  {/* Opening Balance */}
                  <div className="px-5 py-4 flex items-start gap-3.5">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-muted">
                      <IconScale className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                        Opening Balance
                      </p>
                      <motion.p variants={numberPop} className="text-lg font-bold tabular-nums leading-tight truncate">
                        {formatCurrency(openingBalance)}
                      </motion.p>
                    </div>
                  </div>

                  {/* Income */}
                  <div className="px-5 py-4 flex items-start gap-3.5">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-primary/10">
                      <IconArrowUpRight className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                        Income
                      </p>
                      <motion.p variants={numberPop} className="text-lg font-bold text-primary tabular-nums leading-tight truncate">
                        {totalIncome === 0 ? "No income" : formatCurrency(totalIncome)}
                      </motion.p>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="px-5 py-4 flex items-start gap-3.5">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-muted">
                      <IconArrowDownRight className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                        Expenses
                      </p>
                      <motion.p variants={numberPop} className="text-lg font-bold tabular-nums leading-tight truncate">
                        {formatCurrency(totalExpenses)}
                      </motion.p>
                    </div>
                  </div>

                  {/* Current Balance */}
                  <div className="px-5 py-4 flex items-start gap-3.5">
                    <div className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${netChange >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                      <IconWallet className={`size-4 ${netChange >= 0 ? "text-primary" : "text-destructive"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                        Current Balance
                      </p>
                      <motion.p variants={numberPop} className={`text-lg font-bold tabular-nums leading-tight truncate ${netChange >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(closingBalance)}
                      </motion.p>
                      <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5 leading-none">
                        {netChange >= 0 ? "+" : ""}{formatCurrency(netChange)} this month
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* ── One-Time Expense Toggle ── */}
                {hasOneTimeExpenses && (
                  <motion.div
                    variants={fadeUpSmall}
                    className="card-elevated rounded-2xl bg-card flex items-center justify-between px-5 py-3.5 gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                        <IconAlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          Large one-time expenses detected
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {separatedExpenses.oneTime.length} transaction{separatedExpenses.oneTime.length > 1 ? "s" : ""} above {formatCurrency(50000)} totalling{" "}
                          <span className="font-medium text-foreground/80">{formatCurrency(separatedExpenses.oneTimeTotal)}</span>{" "}
                          ({((separatedExpenses.oneTimeTotal / separatedExpenses.totalExpenses) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={excludeOneTime ? "default" : "outline"}
                      size="sm"
                      className="shrink-0 rounded-lg"
                      onClick={() => setExcludeOneTime((prev) => !prev)}
                    >
                      {excludeOneTime ? `Recurring only (${separatedExpenses.oneTime.length} excluded)` : "Exclude one-time"}
                    </Button>
                  </motion.div>
                )}

                {/* ── Tabs ── */}
                <motion.div variants={fadeUp}>
                  <Tabs defaultValue="daily" className="space-y-4">
                    <TabsList className="inline-flex h-10 gap-1 rounded-xl bg-muted/50 p-1">
                      <TabsTrigger value="daily" className="rounded-lg px-4 text-xs font-medium">Daily</TabsTrigger>
                      <TabsTrigger value="weekly" className="rounded-lg px-4 text-xs font-medium">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly" className="rounded-lg px-4 text-xs font-medium">Monthly</TabsTrigger>
                      <TabsTrigger value="comparison" className="rounded-lg px-4 text-xs font-medium">Comparison</TabsTrigger>
                      <TabsTrigger value="trends" className="rounded-lg px-4 text-xs font-medium">Trends</TabsTrigger>
                      <TabsTrigger value="yearly" className="rounded-lg px-4 text-xs font-medium">Yearly</TabsTrigger>
                    </TabsList>

                    {/* ── Daily Tab ── */}
                    <TabsContent value="daily" className="space-y-4">
                      <div className="card-elevated rounded-2xl bg-card p-5">
                        <div className="mb-5">
                          <h3 className="text-sm font-semibold">Daily Cashflow</h3>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">Income and expenses by day</p>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={dailyTrends.map((item) => ({
                            date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" }),
                            income: item.income,
                            expenses: item.expenses,
                          }))} barGap={2}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAxis} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.3, radius: 4 }} />
                            <Bar dataKey="income" fill={CHART_INCOME} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            <Bar dataKey="expenses" fill={CHART_EXPENSE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        <ChartLegend items={[
                          { label: "Income", color: CHART_INCOME },
                          { label: "Expenses", color: CHART_EXPENSE },
                        ]} />
                      </div>

                      {/* Daily Highlights */}
                      <div className="card-elevated rounded-2xl bg-card grid grid-cols-3 divide-x divide-border/40">
                        <div className="px-5 py-4 flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted">
                            <IconCalendarStats className="size-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Avg Daily Spend
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-tight">
                              {formatCurrency(analytics?.dailyAverageSpend || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-4 flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted">
                            <IconReceipt2 className="size-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Transactions
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-tight">
                              {monthTransactions.length}
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-4 flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted">
                            <IconCalendar className="size-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Period
                            </p>
                            <p className="text-lg font-bold leading-tight">
                              {selectedMonth.label}
                            </p>
                          </div>
                        </div>
                      </div>

                      {dailyTrends.length > 0 && (() => {
                        const peakDay = dailyTrends.reduce((max, d) => d.expenses > max.expenses ? d : max, dailyTrends[0])
                        const avgDaily = dailyTrends.reduce((s, d) => s + d.expenses, 0) / dailyTrends.length
                        return (
                          <p className="text-xs text-muted-foreground/70 px-1">
                            Peak spending: {new Date(peakDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })} at {formatCurrency(peakDay.expenses)}. Average daily: {formatCurrency(avgDaily)}.
                          </p>
                        )
                      })()}
                    </TabsContent>

                    {/* ── Weekly Tab ── */}
                    <TabsContent value="weekly" className="space-y-4">
                      <WeeklyAnalyticsContent transactions={transactions} />
                    </TabsContent>

                    {/* ── Monthly Tab ── */}
                    <TabsContent value="monthly" className="space-y-4">
                      <MonthlySummaryCard metrics={monthlyMetrics} />

                      <div className="card-elevated rounded-2xl bg-card p-5">
                        <div className="mb-5">
                          <h3 className="text-sm font-semibold">Balance Trend</h3>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">Selected month balance trend</p>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart
                            data={balanceTrend.map((bt) => ({
                              date: bt.date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                timeZone: "Asia/Kolkata",
                              }),
                              balance: bt.balance,
                            }))}
                          >
                            <defs>
                              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_INCOME} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={CHART_INCOME} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAxis} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="balance"
                              stroke={CHART_INCOME}
                              strokeWidth={2}
                              fill="url(#balanceGradient)"
                              connectNulls
                              isAnimationActive={false}
                              dot={showBalanceTrendDots ? { r: 4, fill: CHART_INCOME } : false}
                              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="card-elevated rounded-2xl bg-card p-5">
                          <div className="mb-5">
                            <h3 className="text-sm font-semibold">Monthly Trends</h3>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">Income and expenses across months</p>
                          </div>
                          <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={monthlyTrends}>
                              <defs>
                                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_INCOME} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={CHART_INCOME} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_EXPENSE} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={CHART_EXPENSE} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                              <XAxis dataKey="monthName" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                              <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAxis} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                              <Tooltip content={<ChartTooltip />} />
                              <Area type="monotone" dataKey="income" stroke={CHART_INCOME} strokeWidth={2} fill="url(#incomeGradient)" connectNulls isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} />
                              <Area type="monotone" dataKey="expenses" stroke={CHART_EXPENSE} strokeWidth={2} fill="url(#expenseGradient)" connectNulls isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} />
                            </AreaChart>
                          </ResponsiveContainer>
                          <ChartLegend items={[
                            { label: "Income", color: CHART_INCOME },
                            { label: "Expenses", color: CHART_EXPENSE },
                          ]} />
                        </div>
                        <CategoryChart data={categoryBreakdown} />
                      </div>

                      {monthlyTrends.length >= 2 && (() => {
                        const recent = monthlyTrends.slice(-6)
                        const first = recent[0]?.expenses ?? 0
                        const last = recent[recent.length - 1]?.expenses ?? 0
                        const trend = last > first * 1.1 ? "rising" : last < first * 0.9 ? "falling" : "stable"
                        return (
                          <p className="text-xs text-muted-foreground/70 px-1">
                            Spending trend: {trend} over last {recent.length} months.
                          </p>
                        )
                      })()}

                      <PaymentMethodChart
                        data={(analytics?.paymentMethodBreakdown || []).map((pm) => ({
                          method: pm.method,
                          count: pm.transactionCount,
                          amount: pm.amount,
                        }))}
                      />
                    </TabsContent>

                    {/* ── Comparison Tab (Month-over-Month) ── */}
                    <TabsContent value="comparison" className="space-y-4">
                      {/* Change Summary Cards */}
                      <div className="card-elevated rounded-2xl bg-card grid grid-cols-1 @lg/main:grid-cols-3 divide-y @lg/main:divide-y-0 @lg/main:divide-x divide-border/40">
                        {/* Income Change */}
                        <div className="px-5 py-4 flex items-start gap-3.5">
                          <div className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${comparisonChanges.income.change >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                            {comparisonChanges.income.change >= 0
                              ? <IconTrendingUp className="size-4 text-primary" />
                              : <IconTrendingDown className="size-4 text-destructive" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Income
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-tight truncate">
                              {formatCurrency(comparisonChanges.income.current)}
                            </p>
                            <p className={`text-[11px] font-semibold mt-0.5 leading-none ${comparisonChanges.income.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {comparisonChanges.income.change >= 0 ? "\u2191" : "\u2193"} {Math.abs(comparisonChanges.income.change).toFixed(1)}% vs {previousMonth.label.split(" ")[0]}
                            </p>
                          </div>
                        </div>

                        {/* Expense Change */}
                        <div className="px-5 py-4 flex items-start gap-3.5">
                          <div className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${comparisonChanges.expense.change <= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                            <IconArrowsExchange className={`size-4 ${comparisonChanges.expense.change <= 0 ? "text-primary" : "text-destructive"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Expenses
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-tight truncate">
                              {formatCurrency(comparisonChanges.expense.current)}
                            </p>
                            {/* For expenses, decrease is good (green), increase is bad (red) */}
                            <p className={`text-[11px] font-semibold mt-0.5 leading-none ${comparisonChanges.expense.change <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {comparisonChanges.expense.change > 0 ? "\u2191" : "\u2193"} {Math.abs(comparisonChanges.expense.change).toFixed(1)}% vs {previousMonth.label.split(" ")[0]}
                            </p>
                          </div>
                        </div>

                        {/* Savings Change */}
                        <div className="px-5 py-4 flex items-start gap-3.5">
                          <div className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${comparisonChanges.savings.current >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                            <IconWallet className={`size-4 ${comparisonChanges.savings.current >= 0 ? "text-primary" : "text-destructive"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
                              Net Savings
                            </p>
                            <p className={`text-lg font-bold tabular-nums leading-tight truncate ${comparisonChanges.savings.current >= 0 ? "text-primary" : "text-destructive"}`}>
                              {formatCurrency(comparisonChanges.savings.current)}
                            </p>
                            <p className={`text-[11px] font-semibold mt-0.5 leading-none ${comparisonChanges.savings.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {comparisonChanges.savings.change >= 0 ? "\u2191" : "\u2193"} {Math.abs(comparisonChanges.savings.change).toFixed(1)}% vs {previousMonth.label.split(" ")[0]}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Top Category Changes as Badges */}
                      {topCategoryChanges.length > 0 && (
                        <div className="card-elevated rounded-2xl bg-card px-5 py-4">
                          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">
                            Biggest Changes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {topCategoryChanges.map((change) => (
                              <Badge
                                key={change.category}
                                variant="secondary"
                                className={`text-xs font-medium px-3 py-1.5 ${
                                  // For expenses: increase is bad (red), decrease is good (green)
                                  change.change > 0
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                }`}
                              >
                                {change.category} {change.change > 0 ? "\u2191" : "\u2193"} {Math.abs(change.change).toFixed(0)}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grouped Bar Chart */}
                      <div className="card-elevated rounded-2xl bg-card p-5">
                        <div className="mb-5">
                          <h3 className="text-sm font-semibold">Category Comparison</h3>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {selectedMonth.label} vs {previousMonth.label} expenses by category
                          </p>
                        </div>
                        {comparisonData.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={360}>
                              <BarChart data={comparisonData} barGap={4}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                                <XAxis
                                  dataKey="category"
                                  tickLine={false}
                                  axisLine={false}
                                  tickMargin={10}
                                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                  interval={0}
                                  angle={-30}
                                  textAnchor="end"
                                  height={60}
                                />
                                <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAxis} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                                <Tooltip content={<ComparisonTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.3, radius: 4 }} />
                                <Bar dataKey="current" name={selectedMonth.label.split(" ")[0]} fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                <Bar dataKey="previous" name={previousMonth.label.split(" ")[0]} fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                              </BarChart>
                            </ResponsiveContainer>
                            <ChartLegend items={[
                              { label: selectedMonth.label.split(" ")[0], color: "var(--chart-2)" },
                              { label: previousMonth.label.split(" ")[0], color: "var(--muted-foreground)" },
                            ]} />
                          </>
                        ) : (
                          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                            No comparison data available. Need at least 2 months of transactions.
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* ── Trends Tab (Category Trends Over Time) ── */}
                    <TabsContent value="trends" className="space-y-4">
                      <div className="card-elevated rounded-2xl bg-card p-5">
                        <div className="mb-5 flex items-center gap-2">
                          <IconChartLine className="size-4 text-muted-foreground" />
                          <div>
                            <h3 className="text-sm font-semibold">Category Spending Trends</h3>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              Per-category expense trends over the last 6 months. Click categories to toggle.
                            </p>
                          </div>
                        </div>
                        {trendData.length > 0 && trendCategories.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={360}>
                              <LineChart data={trendData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                                <XAxis
                                  dataKey="month"
                                  tickLine={false}
                                  axisLine={false}
                                  tickMargin={10}
                                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={formatCompactAxis}
                                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                  width={52}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                {trendCategories.map((cat, i) => (
                                  <Line
                                    key={cat}
                                    type="monotone"
                                    dataKey={cat}
                                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: TREND_COLORS[i % TREND_COLORS.length] }}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                                    connectNulls
                                    isAnimationActive={false}
                                    hide={!visibleTrendCategories.has(cat)}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                            <TrendLegend
                              categories={trendCategories.map((cat, i) => ({
                                name: cat,
                                color: TREND_COLORS[i % TREND_COLORS.length],
                              }))}
                              visibleCategories={visibleTrendCategories}
                              onToggle={toggleTrendCategory}
                            />
                          </>
                        ) : (
                          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                            Not enough data for trend analysis. Need at least 2 months of transactions.
                          </div>
                        )}
                      </div>

                      {/* Trend Insight */}
                      {trendData.length >= 2 && trendCategories.length > 0 && (() => {
                        // Find the category with the biggest increase over the period
                        let maxIncreaseCat = ""
                        let maxIncrease = -Infinity
                        let maxDecreaseCat = ""
                        let maxDecrease = Infinity
                        for (const cat of trendCategories) {
                          const first = trendData[0]?.[cat] || 0
                          const last = trendData[trendData.length - 1]?.[cat] || 0
                          const change = first > 0 ? ((last - first) / first) * 100 : 0
                          if (change > maxIncrease) {
                            maxIncrease = change
                            maxIncreaseCat = cat
                          }
                          if (change < maxDecrease) {
                            maxDecrease = change
                            maxDecreaseCat = cat
                          }
                        }
                        return (
                          <p className="text-xs text-muted-foreground/70 px-1">
                            {maxIncreaseCat && maxIncrease > 0 && (
                              <>Fastest growing: {maxIncreaseCat} (+{maxIncrease.toFixed(0)}%). </>
                            )}
                            {maxDecreaseCat && maxDecrease < 0 && (
                              <>Most improved: {maxDecreaseCat} ({maxDecrease.toFixed(0)}%). </>
                            )}
                          </p>
                        )
                      })()}
                    </TabsContent>

                    {/* ── Yearly Tab ── */}
                    <TabsContent value="yearly" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="card-elevated rounded-2xl bg-card p-5">
                          <div className="mb-4">
                            <h3 className="text-sm font-semibold">Year Over Year</h3>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              Current year vs last year
                              {yoyGrowth.isAnnualized && (
                                <>
                                  <Badge variant="secondary" className="ml-2 text-[11px]">Annualized</Badge>
                                  <InfoTooltip text="Since this year isn't over yet, we project totals to a full 12-month period for fair comparison." />
                                </>
                              )}
                            </p>
                          </div>
                          <div className="space-y-3.5">
                            {[
                              { label: "Income Growth", value: yoyGrowth.incomeGrowth },
                              { label: "Expense Growth", value: yoyGrowth.expenseGrowth },
                              { label: "Savings Growth", value: yoyGrowth.savingsGrowth },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <span className={`text-sm font-bold tabular-nums ${value >= 0 ? "text-primary" : "text-destructive"}`}>
                                  {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                            {yoyGrowth.isAnnualized && (
                              <p className="text-[11px] text-muted-foreground/60 pt-1">
                                * Current year data projected to full year
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="card-elevated rounded-2xl bg-card p-5 md:col-span-2">
                          <div className="mb-5">
                            <h3 className="text-sm font-semibold">Annual Performance</h3>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">Income vs expenses by year</p>
                          </div>
                          <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={yearlyData}>
                              <defs>
                                <linearGradient id="yearIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_INCOME} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={CHART_INCOME} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="yearExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_EXPENSE} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={CHART_EXPENSE} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.4} />
                              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                              <Tooltip content={<ChartTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="income"
                                stroke={CHART_INCOME}
                                strokeWidth={2}
                                fill="url(#yearIncomeGradient)"
                                connectNulls
                                isAnimationActive={false}
                                dot={showYearlyDots ? { r: 4, fill: CHART_INCOME } : false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                              />
                              <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke={CHART_EXPENSE}
                                strokeWidth={2}
                                fill="url(#yearExpenseGradient)"
                                connectNulls
                                isAnimationActive={false}
                                dot={showYearlyDots ? { r: 4, fill: CHART_EXPENSE } : false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          <ChartLegend items={[
                            { label: "Income", color: CHART_INCOME },
                            { label: "Expenses", color: CHART_EXPENSE },
                          ]} />
                        </div>
                      </div>
                      {yearlyData.length > 0 && (() => {
                        const current = yearlyData.find(d => d.year === currentYear)
                        if (!current) return null
                        const savedYTD = current.income - current.expenses
                        const pct = current.income > 0 ? ((savedYTD / current.income) * 100).toFixed(1) : "0"
                        return (
                          <p className="text-xs text-muted-foreground/70 px-1">
                            Year-to-date savings: {formatCurrency(savedYTD)} ({pct}% of income).
                          </p>
                        )
                      })()}
                    </TabsContent>
                  </Tabs>
                </motion.div>

                {/* ── Spending Comparison (standalone widget) ── */}
                <motion.div variants={fadeUp}>
                  <SpendingComparison transactions={transactions} />
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="card-elevated rounded-2xl bg-card grid grid-cols-4 divide-x divide-border/40">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4 flex items-start gap-3.5">
            <Skeleton className="size-9 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-64 rounded-xl" />
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  )
}
