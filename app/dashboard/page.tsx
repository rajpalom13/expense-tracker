"use client"

import * as React from "react"
import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconChartBar,
  IconReceipt,
  IconRefresh,
  IconTrendingUp,
  IconWallet,
  IconScale,
} from "@tabler/icons-react"

import { stagger, fadeUp, fadeUpSmall, numberPop, listItem } from "@/lib/motion"
import { getPartialMonthInfo } from "@/lib/edge-cases"
import { ContextBanner } from "@/components/context-banner"
import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"

import {
  calculateMonthlyMetrics,
  getCurrentMonth,
  getMonthTransactions,
} from "@/lib/monthly-utils"
import { calculateCategoryBreakdown } from "@/lib/analytics"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AiInsightsWidget } from "@/components/ai-insights-widget"
import { SyncButtonCompact } from "@/components/sync-button"
import { RecurringTransactions } from "@/components/recurring-transactions"
import { SectionErrorBoundary } from "@/components/error-boundary"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR as formatCurrency } from "@/lib/format"

/* ─── Category color palette ─── */
const CATEGORY_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
]

const CATEGORY_BAR_GRADIENTS = [
  "from-emerald-500/80 to-emerald-500/40",
  "from-blue-500/80 to-blue-500/40",
  "from-amber-500/80 to-amber-500/40",
  "from-rose-500/80 to-rose-500/40",
  "from-violet-500/80 to-violet-500/40",
  "from-cyan-500/80 to-cyan-500/40",
  "from-orange-500/80 to-orange-500/40",
  "from-pink-500/80 to-pink-500/40",
]

/* ─── Stat card config ─── */
const STAT_CONFIG = [
  {
    key: "opening",
    label: "Opening Balance",
    icon: IconScale,
    iconBg: "bg-blue-500/10 dark:bg-blue-500/15",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "income",
    label: "Income",
    icon: IconArrowUpRight,
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: IconArrowDownRight,
    iconBg: "bg-rose-500/10 dark:bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    key: "balance",
    label: "Current Balance",
    icon: IconWallet,
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
] as const

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const {
    transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    syncFromSheets,
    refresh,
  } = useTransactions()

  const { year, month, label: monthLabel } = getCurrentMonth()
  const monthTransactions = getMonthTransactions(transactions, year, month)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  const monthlyMetrics = transactions.length > 0
    ? calculateMonthlyMetrics(transactions, year, month)
    : null

  const categoryBreakdown = calculateCategoryBreakdown(monthTransactions)

  // Check if current month has no income but previous month had salary
  // (salary landed in previous month due to irregular pay cycles)
  const noIncomeContext = useMemo(() => {
    if (!monthlyMetrics || monthlyMetrics.totalIncome > 0) return null
    // Check if previous month had income
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth < 1) { prevMonth = 12; prevYear = year - 1 }
    const prevMetrics = calculateMonthlyMetrics(transactions, prevYear, prevMonth)
    if (prevMetrics.totalIncome > 0) {
      return "Salary likely received in previous month"
    }
    return null
  }, [transactions, year, month, monthlyMetrics])

  const monthlyTrendData = useMemo(() => {
    if (transactions.length === 0) return []
    const data: { name: string; income: number; expenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      let m = month - i
      let y = year
      while (m < 1) { m += 12; y -= 1 }
      const metrics = calculateMonthlyMetrics(transactions, y, m)
      const shortLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" })
      data.push({ name: shortLabel, income: metrics.totalIncome, expenses: metrics.totalExpenses })
    }
    return data
  }, [transactions, year, month])

  const recentTransactions = useMemo(() => {
    return [...monthTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [monthTransactions])

  const isLoading = authLoading || transactionsLoading
  const totalIncome = monthlyMetrics?.totalIncome || 0
  const totalExpenses = monthlyMetrics?.totalExpenses || 0
  const openingBalance = monthlyMetrics?.openingBalance || 0
  const closingBalance = monthlyMetrics?.closingBalance || 0
  const netChange = monthlyMetrics?.netChange || 0

  const VISIBLE_CATEGORIES = 6
  const visibleCategories = categoryBreakdown.slice(0, VISIBLE_CATEGORIES)
  const hiddenCount = Math.max(0, categoryBreakdown.length - VISIBLE_CATEGORIES)

  const statValues = [
    formatCurrency(openingBalance),
    formatCurrency(totalIncome),
    formatCurrency(totalExpenses),
    formatCurrency(closingBalance),
  ]

  const statValueColors = [
    "text-blue-600 dark:text-blue-400",
    totalIncome === 0 ? "text-muted-foreground" : "",
    "",
    "",
  ]

  /* ─── Predictive Cashflow ─── */
  const cashflowForecast = useMemo(() => {
    const daysElapsed = Math.max(1, new Date().getDate())
    const totalDaysInMonth = new Date(year, month, 0).getDate()
    const projectedExpenses = (totalExpenses / daysElapsed) * totalDaysInMonth
    const dailyAvgSpend = totalExpenses / daysElapsed
    const remainingDays = Math.max(0, totalDaysInMonth - daysElapsed)
    const remainingDailyBudget = totalIncome > 0 && remainingDays > 0
      ? (totalIncome - totalExpenses) / remainingDays
      : 0

    let projectedColor = "text-emerald-600 dark:text-emerald-400"
    if (totalIncome > 0) {
      if (projectedExpenses > totalIncome) {
        projectedColor = "text-rose-600 dark:text-rose-400"
      } else if (projectedExpenses > totalIncome * 0.9) {
        projectedColor = "text-amber-600 dark:text-amber-400"
      }
    }

    return {
      projectedExpenses,
      dailyAvgSpend,
      remainingDays,
      remainingDailyBudget,
      projectedColor,
      totalDaysInMonth,
    }
  }, [totalExpenses, totalIncome, year, month])

  /* ─── Smart Daily Summary ─── */
  const dailySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayTxns = monthTransactions.filter(
      t => new Date(t.date).toISOString().slice(0, 10) === todayStr
    ).filter(t => t.type === "expense")
    const todaySpent = todayTxns.reduce((sum, t) => sum + t.amount, 0)

    const topCategory = todayTxns.length > 0
      ? Object.entries(
          todayTxns.reduce<Record<string, number>>((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount
            return acc
          }, {})
        )
          .sort((a, b) => b[1] - a[1])[0]?.[0] || ""
      : ""

    const budgetRemaining = totalIncome - totalExpenses
    const totalDaysInMonth = new Date(year, month, 0).getDate()
    const daysElapsed = Math.max(1, new Date().getDate())
    const remainingDays = Math.max(0, totalDaysInMonth - daysElapsed)
    const dailyBudget = remainingDays > 0 ? budgetRemaining / remainingDays : 0

    return { todaySpent, topCategory, budgetRemaining, remainingDays, dailyBudget }
  }, [monthTransactions, totalIncome, totalExpenses, year, month])

  /* ─── Anomaly Detection ─── */
  const anomalies = useMemo(() => {
    if (!monthTransactions.length) return []

    const expenses = monthTransactions.filter(t => t.type === "expense")
    const categoryAmounts: Record<string, number[]> = {}
    expenses.forEach(t => {
      if (!categoryAmounts[t.category]) categoryAmounts[t.category] = []
      categoryAmounts[t.category].push(t.amount)
    })

    const results: Array<{ description: string; amount: number; category: string; reason: string }> = []
    expenses.forEach(t => {
      const amounts = categoryAmounts[t.category] || []
      if (amounts.length < 3) return
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length
      const stddev = Math.sqrt(amounts.reduce((s, a) => s + (a - avg) ** 2, 0) / amounts.length)
      if (stddev > 0 && t.amount > avg + 2 * stddev) {
        results.push({
          description: t.merchant || t.description,
          amount: t.amount,
          category: t.category,
          reason: `${(t.amount / avg).toFixed(1)}x above average`,
        })
      }
    })
    return results.sort((a, b) => b.amount - a.amount).slice(0, 3)
  }, [monthTransactions])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!isAuthenticated) return null

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
          title="Dashboard"
          subtitle={monthLabel}
          actions={
            <SyncButtonCompact onSync={async () => { await syncFromSheets(false) }} />
          }
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-5 p-4 md:p-6">
            {isLoading ? (
              <DashboardLoadingSkeleton />
            ) : transactionsError ? (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] gap-4">
                <IconAlertCircle className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Failed to load data</h3>
                  <p className="text-sm text-muted-foreground mt-1">{transactionsError}</p>
                </div>
                <Button variant="outline" onClick={() => refresh()}>
                  <IconRefresh className="mr-2 h-4 w-4" /> Try Again
                </Button>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5">
                {(() => {
                  const partialInfo = getPartialMonthInfo(monthTransactions, year, month)
                  return partialInfo.isPartial ? <ContextBanner variant="info" title={partialInfo.message} /> : null
                })()}

                {/* ─── Daily Budget Pulse ─── */}
                <motion.div
                  variants={fadeUpSmall}
                  className="rounded-2xl border border-white/10 bg-card/50 backdrop-blur-xl p-5 shadow-xl shadow-black/5"
                >
                  <div className="flex items-center gap-5">
                    {/* Circular progress ring */}
                    {(() => {
                      const dailyLimit = dailySummary.dailyBudget + dailySummary.todaySpent / (dailySummary.remainingDays > 0 ? 1 : 1)
                      const effectiveDailyLimit = totalIncome > 0
                        ? totalIncome / new Date(year, month, 0).getDate()
                        : 0
                      const spentPct = effectiveDailyLimit > 0
                        ? Math.min((dailySummary.todaySpent / effectiveDailyLimit) * 100, 100)
                        : 0
                      const ringSize = 72
                      const strokeWidth = 6
                      const radius = (ringSize - strokeWidth) / 2
                      const circumference = 2 * Math.PI * radius
                      const strokeDashoffset = circumference * (1 - spentPct / 100)
                      const ringColor = spentPct >= 100
                        ? "#f43f5e"
                        : spentPct >= 80
                          ? "#f59e0b"
                          : "#10b981"

                      return (
                        <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
                          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                            <circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={radius}
                              fill="none"
                              stroke="var(--border)"
                              strokeWidth={strokeWidth}
                              strokeOpacity={0.3}
                            />
                            <motion.circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={radius}
                              fill="none"
                              stroke={ringColor}
                              strokeWidth={strokeWidth}
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                              initial={{ strokeDashoffset: circumference }}
                              animate={{ strokeDashoffset }}
                              transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-sm font-bold tabular-nums" style={{ color: ringColor }}>
                              {Math.round(spentPct)}%
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Text details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Today&apos;s Spending</p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {formatCurrency(dailySummary.todaySpent)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dailySummary.todaySpent > 0 && dailySummary.topCategory
                          ? `Mostly on ${dailySummary.topCategory}`
                          : "No spending recorded today"}
                      </p>
                    </div>

                    {/* Right stats */}
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Daily Budget</p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(dailySummary.dailyBudget)}</p>
                      </div>
                      <div className="h-8 w-px bg-border/40" />
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Days Left</p>
                        <p className="text-sm font-semibold tabular-nums">{dailySummary.remainingDays}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ─── Stat Bar ─── */}
                <motion.div
                  variants={fadeUp}
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                >
                  {STAT_CONFIG.map((stat, i) => {
                    const Icon = stat.icon
                    return (
                      <motion.div
                        key={stat.key}
                        variants={fadeUpSmall}
                        className="card-elevated rounded-xl bg-card p-4 flex items-start gap-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:scale-[1.01]"
                      >
                        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${stat.iconBg} shrink-0`}>
                          <Icon className={`h-5 w-5 ${stat.iconColor}`} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                            {stat.label}
                          </p>
                          <motion.p
                            variants={numberPop}
                            className={`text-xl font-bold tabular-nums truncate ${statValueColors[i]}`}
                          >
                            {statValues[i]}
                          </motion.p>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>

                {/* ─── Predictive Cashflow ─── */}
                <motion.div variants={fadeUp} className="card-elevated rounded-xl bg-card p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500/15 to-pink-500/15">
                      <IconTrendingUp className="h-4 w-4 text-violet-500" />
                    </div>
                    <h3 className="text-sm font-semibold">Cashflow Forecast</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Projected Month-End</p>
                      <p className={`text-lg font-bold tabular-nums ${cashflowForecast.projectedColor}`}>
                        {formatCurrency(cashflowForecast.projectedExpenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Daily Average</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(cashflowForecast.dailyAvgSpend)}/day</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Remaining Budget</p>
                      <p className={`text-lg font-bold tabular-nums ${cashflowForecast.remainingDailyBudget > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                        {formatCurrency(Math.abs(cashflowForecast.remainingDailyBudget))}/day
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* ─── Main Row: Spending Breakdown + Monthly Summary ─── */}
                <motion.div variants={fadeUp} className="grid gap-5 lg:grid-cols-5">
                  {/* Spending Breakdown */}
                  <div className="lg:col-span-3 card-elevated rounded-xl bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/15 to-purple-500/15">
                          <IconChartBar className="h-4 w-4 text-blue-500" />
                        </div>
                        <h3 className="text-sm font-semibold">Spending Breakdown</h3>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{categoryBreakdown.length} categories</span>
                    </div>

                    <div className="space-y-2.5">
                      {visibleCategories.map((cat, i) => {
                        const anim = listItem(i)
                        return (
                          <motion.div
                            key={cat.category}
                            initial={anim.initial}
                            animate={anim.animate}
                            transition={anim.transition}
                            className="group rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-muted/40 transition-colors cursor-default"
                          >
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} shrink-0`} />
                                <span className="font-medium text-foreground/90">{cat.category}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold tabular-nums">{formatCurrency(cat.amount)}</span>
                                <span className="text-[11px] font-medium text-muted-foreground tabular-nums w-10 text-right bg-muted/50 px-1.5 py-0.5 rounded-md">
                                  {cat.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                              <motion.div
                                className={`h-2 rounded-full bg-gradient-to-r ${CATEGORY_BAR_GRADIENTS[i % CATEGORY_BAR_GRADIENTS.length]}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(cat.percentage, 1)}%` }}
                                transition={{ delay: 0.15 + i * 0.04, duration: 0.45, ease: [0, 0, 0.2, 1] as const }}
                              />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {hiddenCount > 0 && (
                      <p className="mt-4 text-xs text-muted-foreground pl-2.5">
                        +{hiddenCount} more {hiddenCount === 1 ? "category" : "categories"}
                      </p>
                    )}

                    {visibleCategories.length === 0 && (
                      <p className="text-sm text-muted-foreground py-8 text-center">No expenses recorded this month.</p>
                    )}
                  </div>

                  {/* ─── Monthly Summary ─── */}
                  <div className="lg:col-span-2 card-elevated rounded-xl bg-card p-5 flex flex-col transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/15">
                        <IconReceipt className="h-4 w-4 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Balance Flow</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="text-center mb-6">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Net Change
                        </p>
                        <motion.span
                          variants={numberPop}
                          className={`text-4xl font-extrabold tabular-nums block ${
                            netChange >= 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {netChange >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netChange))}
                        </motion.span>
                        <motion.p
                          variants={fadeUpSmall}
                          className="text-xs mt-1.5 font-medium text-muted-foreground"
                        >
                          {formatCurrency(openingBalance)} &rarr; {formatCurrency(closingBalance)}
                        </motion.p>
                        {noIncomeContext && (
                          <motion.p
                            variants={fadeUpSmall}
                            className="text-[11px] mt-2 text-amber-600 dark:text-amber-400 font-medium"
                          >
                            {noIncomeContext}
                          </motion.p>
                        )}
                      </div>

                      <div className="space-y-3.5">
                        <SummaryBar
                          label="Income"
                          value={formatCurrency(totalIncome)}
                          pct={openingBalance + totalIncome > 0 ? (totalIncome / (openingBalance + totalIncome)) * 100 : 0}
                          barClass="bg-primary"
                          trackClass="bg-primary/10"
                        />
                        <SummaryBar
                          label="Expenses"
                          value={formatCurrency(totalExpenses)}
                          pct={openingBalance + totalIncome > 0 ? Math.min((totalExpenses / (openingBalance + totalIncome)) * 100, 100) : 0}
                          barClass={totalExpenses > openingBalance + totalIncome ? "bg-destructive" : "bg-muted-foreground/30"}
                          trackClass="bg-muted/60"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ─── Unusual Activity ─── */}
                {anomalies.length > 0 && (
                  <motion.div variants={fadeUp} className="card-elevated rounded-xl bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10">
                        <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Unusual Activity</h3>
                      <Badge variant="outline" className="ml-auto text-xs">{anomalies.length} flagged</Badge>
                    </div>
                    <div className="space-y-2.5">
                      {anomalies.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <div>
                            <p className="text-sm font-medium">{a.description}</p>
                            <p className="text-xs text-muted-foreground">{a.category} &middot; {a.reason}</p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                            {formatCurrency(a.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ─── Bottom 2-col grid: Transactions + Trend ─── */}
                <motion.div variants={fadeUp} className="grid gap-5 lg:grid-cols-2">

                {/* ─── Recent Transactions ─── */}
                <div className="card-elevated rounded-xl bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Recent Transactions</h3>
                    <Link
                      href="/transactions"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                    >
                      View All <IconArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>

                  {recentTransactions.length > 0 ? (
                    <div className="divide-y divide-border/30">
                      {recentTransactions.map((t, i) => {
                        const txDate = new Date(t.date)
                        const dateStr = txDate.toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", timeZone: "Asia/Kolkata",
                        })
                        const isIncome = t.type === "income"
                        const anim = listItem(i)
                        return (
                          <motion.div
                            key={t.id}
                            initial={anim.initial}
                            animate={anim.animate}
                            transition={anim.transition}
                            className="flex items-center justify-between py-3 gap-3 hover:bg-muted/30 -mx-3 px-3 rounded-lg transition-colors first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-sm font-medium truncate">{t.merchant || t.description}</span>
                              <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 border border-border/40 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide">
                                {t.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">{dateStr}</span>
                              <span className={`text-sm font-semibold tabular-nums min-w-[80px] text-right ${isIncome ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                {isIncome ? "+" : "-"}{formatCurrency(t.amount)}
                              </span>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">No transactions this month.</p>
                  )}
                </div>

                {/* ─── Monthly Trend ─── */}
                <div>
                  <SectionErrorBoundary name="monthly-trend">
                    <div className="card-elevated rounded-xl bg-card p-5">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">Monthly Trend</h3>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-[3px] bg-chart-1" />
                            <span className="text-[11px] text-muted-foreground">Income</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-[3px] bg-chart-5" />
                            <span className="text-[11px] text-muted-foreground">Expenses</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>

                      {monthlyTrendData.some((d) => d.income > 0 || d.expenses > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={monthlyTrendData} barGap={6}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={55} />
                            <Tooltip
                              formatter={(value: number, name: string) => [formatCurrency(value), name === "income" ? "Income" : "Expenses"]}
                              contentStyle={{
                                borderRadius: 10,
                                fontSize: 12,
                                border: "1px solid var(--border)",
                                background: "var(--card)",
                                color: "var(--card-foreground)",
                                boxShadow: "0 4px 16px oklch(0 0 0 / 8%)",
                              }}
                              cursor={{ fill: "var(--muted)", opacity: 0.3, radius: 6 }}
                            />
                            <Bar dataKey="income" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="expenses" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                          No data available.
                        </div>
                      )}
                    </div>
                  </SectionErrorBoundary>
                </div>

                </motion.div>

                {/* ─── Bottom 2-col grid: Recurring + AI Insights ─── */}
                <motion.div variants={fadeUp} className="grid gap-5 lg:grid-cols-2">
                  <SectionErrorBoundary name="recurring-transactions">
                    <RecurringTransactions compact />
                  </SectionErrorBoundary>

                  <AiInsightsWidget compact />
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


/* ─── Summary Bar (Income / Expenses comparison) ─── */
function SummaryBar({ label, value, pct, barClass, trackClass }: {
  label: string
  value: string
  pct: number
  barClass: string
  trackClass: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-foreground/70">{label}</span>
        <span className="font-semibold tabular-nums text-foreground/90">{value}</span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${trackClass} overflow-hidden`}>
        <motion.div
          className={`h-2.5 rounded-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0, 0, 0.2, 1] as const }}
        />
      </div>
    </div>
  )
}


/* ─── Loading Skeleton ─── */
function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-elevated rounded-xl bg-card p-4 flex items-start gap-3.5">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 card-elevated rounded-xl bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 card-elevated rounded-xl bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-12 w-36 mx-auto mt-4" />
          <Skeleton className="h-2.5 w-full mt-4 rounded-full" />
          <Skeleton className="h-2.5 w-3/4 rounded-full" />
        </div>
      </div>
      <div className="card-elevated rounded-xl bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <div className="card-elevated rounded-xl bg-card p-5">
        <Skeleton className="h-5 w-28 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    </div>
  )
}
