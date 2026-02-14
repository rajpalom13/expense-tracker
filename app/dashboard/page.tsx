"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconChartLine,
  IconCreditCard,
  IconDatabase,
  IconHeartbeat,
  IconPigMoney,
  IconShieldCheck,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react"

import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import { transformTransactionsForTable } from "@/lib/transform-transactions"
import {
  calculateMonthlyMetrics,
  getCurrentMonth,
  getMonthTransactions,
} from "@/lib/monthly-utils"
import {
  calculateCategoryBreakdown,
  calculateDailyTrends,
  calculateMonthlyTrends,
  calculatePaymentMethodBreakdown,
  getTopMerchants,
} from "@/lib/analytics"
import {
  calculateAccountSummary,
  calculateBalanceTrend,
  getBalanceAtDate,
} from "@/lib/balance-utils"
import { isCompletedStatus } from "@/lib/utils"
import {
  getCurrentWeek,
  getWeekEndDate,
  getWeekStartDate,
  getWeekTransactions,
} from "@/lib/weekly-utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CategoryChart } from "@/components/category-chart"
import { PaymentMethodChart } from "@/components/payment-method-chart"
import { MetricTile } from "@/components/metric-tile"
import { AiInsightsWidget } from "@/components/ai-insights-widget"
import { PeriodBridge } from "@/components/period-bridge"
import { SyncButtonCompact } from "@/components/sync-button"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompactAxis(value: number): string {
  if (Math.abs(value) < 1000) {
    return `₹${value.toFixed(0)}`
  }
  return `₹${(value / 1000).toFixed(0)}k`
}

const trendConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-2))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const {
    transactions,
    isLoading: transactionsLoading,
    syncFromSheets,
  } = useTransactions()

  const [nwiSplit, setNwiSplit] = useState<{
    totalIncome: number
    needs: { targetPercentage: number; actualPercentage: number; actualAmount: number; targetAmount: number }
    wants: { targetPercentage: number; actualPercentage: number; actualAmount: number; targetAmount: number }
    investments: { targetPercentage: number; actualPercentage: number; actualAmount: number; targetAmount: number }
  } | null>(null)
  const [healthMetrics, setHealthMetrics] = useState<{
    financialFreedomScore: number
    scoreBreakdown: { savingsRate: number; emergencyFund: number; nwiAdherence: number; investmentRate: number }
    emergencyFundMonths: number
    emergencyFundTarget: number
  } | null>(null)

  const { year, month, label: monthLabel } = getCurrentMonth()
  const currentWeek = getCurrentWeek()
  const monthTransactions = getMonthTransactions(transactions, year, month)

  useEffect(() => {
    if (!isAuthenticated) return
    fetch("/api/nwi-config")
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.config) return
        // Compute NWI split from current month transactions
        const config = data.config
        const completed = monthTransactions.filter(
          (t: { type: string; status: string }) => t.type === "expense" && isCompletedStatus(t.status)
        )
        const income = monthTransactions
          .filter((t: { type: string; status: string }) => t.type === "income" && isCompletedStatus(t.status))
          .reduce((s: number, t: { amount: number }) => s + t.amount, 0)

        const classify = (cat: string) => {
          if (config.needs.categories.includes(cat)) return "needs"
          if (config.investments.categories.includes(cat)) return "investments"
          return "wants"
        }

        const buckets = { needs: 0, wants: 0, investments: 0 }
        for (const t of completed) {
          buckets[classify(t.category)] += t.amount
        }
        const total = buckets.needs + buckets.wants + buckets.investments

        setNwiSplit({
          totalIncome: income,
          needs: {
            targetPercentage: config.needs.percentage,
            actualPercentage: total > 0 ? (buckets.needs / total) * 100 : 0,
            actualAmount: buckets.needs,
            targetAmount: income * config.needs.percentage / 100,
          },
          wants: {
            targetPercentage: config.wants.percentage,
            actualPercentage: total > 0 ? (buckets.wants / total) * 100 : 0,
            actualAmount: buckets.wants,
            targetAmount: income * config.wants.percentage / 100,
          },
          investments: {
            targetPercentage: config.investments.percentage,
            actualPercentage: total > 0 ? (buckets.investments / total) * 100 : 0,
            actualAmount: buckets.investments,
            targetAmount: income * config.investments.percentage / 100,
          },
        })
      })
      .catch(() => {})

    fetch("/api/financial-health")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.metrics) {
          setHealthMetrics({
            financialFreedomScore: data.metrics.financialFreedomScore,
            scoreBreakdown: data.metrics.scoreBreakdown,
            emergencyFundMonths: data.metrics.emergencyFundMonths,
            emergencyFundTarget: data.metrics.emergencyFundTarget,
          })
        }
      })
      .catch(() => {})
  }, [isAuthenticated, monthTransactions])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  const weekTransactions = getWeekTransactions(
    transactions,
    currentWeek.year,
    currentWeek.weekNumber
  )

  const monthlyMetrics = transactions.length > 0
    ? calculateMonthlyMetrics(transactions, year, month)
    : null

  const weekStart = getWeekStartDate(currentWeek.year, currentWeek.weekNumber)
  const weekEnd = getWeekEndDate(currentWeek.year, currentWeek.weekNumber)
  const weekOpening = getBalanceAtDate(
    transactions,
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 1)
  )
  const weekClosing = getBalanceAtDate(transactions, weekEnd)
  const weekIncome = weekTransactions
    .filter((t) => t.type === "income" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)
  const weekExpenses = weekTransactions
    .filter((t) => t.type === "expense" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)

  const accountSummary = calculateAccountSummary(transactions)
  const monthlyTrends = calculateMonthlyTrends(transactions)
  const categoryBreakdown = calculateCategoryBreakdown(monthTransactions)
  const paymentBreakdown = calculatePaymentMethodBreakdown(monthTransactions)
  const dailyTrends = calculateDailyTrends(monthTransactions)
  const balanceTrend = calculateBalanceTrend(transactions)
  const topMerchants = getTopMerchants(monthTransactions, 6)

  const lastSixMonths = monthlyTrends.slice(-6)
  const hasMonthlyTrends = lastSixMonths.length > 0
  const lastDaily = dailyTrends.slice(-14).map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    income: item.income,
    expenses: item.expenses,
    net: item.net,
  }))

  const balanceRunwayData = balanceTrend.slice(-30).map((item) => ({
    date: item.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    balance: item.balance,
  }))
  const hasBalanceRunway = balanceRunwayData.length > 0
  const showBalanceDots = balanceRunwayData.length <= 1
  const hasDailyTrends = lastDaily.length > 0

  const recentTransactions = transformTransactionsForTable(transactions)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

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
          title="Finance Command Center"
          subtitle="Real-time overview of balances, cashflow, and trends"
          actions={
            <>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {monthLabel}
              </Badge>
              <SyncButtonCompact onSync={async () => {
                await syncFromSheets(false)
              }} />
            </>
          }
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-24" />
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <Skeleton className="h-80" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <MetricTile
                    label="Current Balance"
                    value={formatCurrency(accountSummary.currentBalance)}
                    trendLabel={`Opening: ${formatCurrency(accountSummary.openingBalance)}`}
                    change={accountSummary.openingBalance !== 0 ? (accountSummary.netChange / Math.abs(accountSummary.openingBalance)) * 100 : 0}
                    tone={accountSummary.netChange >= 0 ? "positive" : "negative"}
                    icon={<IconWallet className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Month Net Change"
                    value={formatCurrency(monthlyMetrics?.netChange || 0)}
                    change={monthlyMetrics?.growthRate || 0}
                    trendLabel="vs opening balance"
                    tone={(monthlyMetrics?.netChange || 0) >= 0 ? "positive" : "negative"}
                    icon={<IconTrendingUp className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Week Net Change"
                    value={formatCurrency(weekClosing - weekOpening)}
                    change={weekOpening !== 0 ? ((weekClosing - weekOpening) / Math.abs(weekOpening)) * 100 : 0}
                    trendLabel={currentWeek.label}
                    tone={weekClosing - weekOpening >= 0 ? "positive" : "negative"}
                    icon={<IconChartLine className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Monthly Expenses"
                    value={formatCurrency(monthlyMetrics?.totalExpenses || 0)}
                    trendLabel="Current month"
                    icon={<IconCreditCard className="h-5 w-5" />}
                    tone="negative"
                  />
                  <MetricTile
                    label="Monthly Income"
                    value={formatCurrency(monthlyMetrics?.totalIncome || 0)}
                    trendLabel="Current month"
                    icon={<IconDatabase className="h-5 w-5" />}
                    tone="positive"
                  />
                  <MetricTile
                    label={(monthlyMetrics?.savingsRate ?? 0) < 0 ? "Overspend Rate" : "Savings Rate"}
                    value={
                      (monthlyMetrics?.savingsRate ?? 0) < 0
                        ? `Overspent by ${Math.abs(monthlyMetrics?.savingsRate ?? 0).toFixed(1)}%`
                        : `${(monthlyMetrics?.savingsRate ?? 0).toFixed(1)}%`
                    }
                    trendLabel="Income saved"
                    icon={<IconPigMoney className="h-5 w-5" />}
                    tone={(monthlyMetrics?.savingsRate ?? 0) >= 0 ? "positive" : "negative"}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <PeriodBridge
                    title="Month Reference"
                    periodLabel={monthLabel}
                    openingBalance={monthlyMetrics?.openingBalance || 0}
                    inflow={monthlyMetrics?.totalIncome || 0}
                    outflow={monthlyMetrics?.totalExpenses || 0}
                    closingBalance={monthlyMetrics?.closingBalance || 0}
                  />
                  <PeriodBridge
                    title="Week Reference"
                    periodLabel={currentWeek.label}
                    openingBalance={weekOpening}
                    inflow={weekIncome}
                    outflow={weekExpenses}
                    closingBalance={weekClosing}
                  />
                </div>

                {/* Financial Health & NWI Strip */}
                {(healthMetrics || nwiSplit) && (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {/* Financial Freedom Score */}
                    {healthMetrics && (
                      <Card className="border border-border/70">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <IconHeartbeat className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Freedom Score</p>
                                <Link href="/financial-health" className="text-xs text-muted-foreground hover:underline">View details</Link>
                              </div>
                            </div>
                            <span className={`text-3xl font-bold ${
                              healthMetrics.financialFreedomScore >= 75 ? "text-emerald-600" :
                              healthMetrics.financialFreedomScore >= 50 ? "text-amber-600" :
                              "text-rose-600"
                            }`}>
                              {healthMetrics.financialFreedomScore}
                            </span>
                          </div>
                          <Progress
                            value={healthMetrics.financialFreedomScore}
                            className={`h-2 ${
                              healthMetrics.financialFreedomScore >= 75 ? "[&>div]:bg-emerald-500" :
                              healthMetrics.financialFreedomScore >= 50 ? "[&>div]:bg-amber-500" :
                              "[&>div]:bg-rose-500"
                            }`}
                          />
                          <div className="mt-2 grid grid-cols-4 gap-1">
                            {[
                              { label: "Save", value: healthMetrics.scoreBreakdown.savingsRate, max: 25 },
                              { label: "Fund", value: healthMetrics.scoreBreakdown.emergencyFund, max: 25 },
                              { label: "NWI", value: healthMetrics.scoreBreakdown.nwiAdherence, max: 25 },
                              { label: "Invest", value: healthMetrics.scoreBreakdown.investmentRate, max: 25 },
                            ].map(item => (
                              <div key={item.label} className="text-center">
                                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                                <p className="text-xs font-semibold">{item.value}/{item.max}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Emergency Fund */}
                    {healthMetrics && (
                      <Card className="border border-border/70">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <IconShieldCheck className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Emergency Fund</p>
                                <p className="text-xs text-muted-foreground">Target: {healthMetrics.emergencyFundTarget} months</p>
                              </div>
                            </div>
                            <span className={`text-3xl font-bold ${
                              healthMetrics.emergencyFundMonths >= 6 ? "text-emerald-600" :
                              healthMetrics.emergencyFundMonths >= 3 ? "text-amber-600" :
                              "text-rose-600"
                            }`}>
                              {healthMetrics.emergencyFundMonths.toFixed(1)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min((healthMetrics.emergencyFundMonths / healthMetrics.emergencyFundTarget) * 100, 100)}
                            className={`h-2 ${
                              healthMetrics.emergencyFundMonths >= 6 ? "[&>div]:bg-emerald-500" :
                              healthMetrics.emergencyFundMonths >= 3 ? "[&>div]:bg-amber-500" :
                              "[&>div]:bg-rose-500"
                            }`}
                          />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {healthMetrics.emergencyFundMonths >= healthMetrics.emergencyFundTarget
                              ? "You've reached your emergency fund target!"
                              : `${(healthMetrics.emergencyFundTarget - healthMetrics.emergencyFundMonths).toFixed(1)} months to go`}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* NWI Split */}
                    {nwiSplit && (
                      <Card className="border border-border/70">
                        <CardContent className="p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <IconWallet className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">N/W/I Split</p>
                              <p className="text-xs text-muted-foreground">Target vs actual this month</p>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            {[
                              { label: "Needs", data: nwiSplit.needs, color: "bg-blue-500" },
                              { label: "Wants", data: nwiSplit.wants, color: "bg-orange-500" },
                              { label: "Invest", data: nwiSplit.investments, color: "bg-emerald-500" },
                            ].map(item => (
                              <div key={item.label}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-medium">{item.label}</span>
                                  <span className="text-muted-foreground">
                                    {item.data.actualPercentage.toFixed(0)}% / {item.data.targetPercentage}%
                                  </span>
                                </div>
                                <div className="flex h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`${item.color} rounded-full transition-all`}
                                    style={{ width: `${Math.min(item.data.actualPercentage, 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle>Monthly Cashflow</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Income vs expenses for the last 6 months
                      </p>
                    </CardHeader>
                    <CardContent>
                      {hasMonthlyTrends ? (
                        <ChartContainer config={trendConfig} className="h-[300px] w-full">
                          <AreaChart data={lastSixMonths}>
                            <defs>
                              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                              </linearGradient>
                              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="monthName"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={
                                <ChartTooltipContent
                                  indicator="dot"
                                  formatter={(value: number) => formatCurrency(value)}
                                />
                              }
                            />
                            <Area
                              dataKey="income"
                              type="monotone"
                              fill="url(#incomeFill)"
                              stroke="#22c55e"
                              strokeWidth={3}
                              strokeOpacity={0.95}
                              isAnimationActive={false}
                            />
                            <Area
                              dataKey="expenses"
                              type="monotone"
                              fill="url(#expenseFill)"
                              stroke="#f43f5e"
                              strokeWidth={3}
                              strokeOpacity={0.95}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                          No monthly cashflow data yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle>Balance Runway</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Running balance across recent activity
                      </p>
                    </CardHeader>
                    <CardContent>
                      {hasBalanceRunway ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={balanceRunwayData}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={formatCompactAxis}
                            />
                            <Tooltip
                              formatter={(value: number) => formatCurrency(value)}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="balance"
                              stroke="#0ea5e9"
                              strokeWidth={3}
                              strokeOpacity={0.95}
                              connectNulls
                              isAnimationActive={false}
                              dot={showBalanceDots ? { r: 4, fill: "#0ea5e9" } : false}
                              activeDot={{ r: 5, fill: "#0ea5e9" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                          No balance history available yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border border-border/70 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Daily Cashflow</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Last 14 days of inflow and outflow
                      </p>
                    </CardHeader>
                    <CardContent>
                      {hasDailyTrends ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={lastDaily}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              formatter={(value: number) => formatCurrency(value)}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                              }}
                            />
                            <Bar dataKey="income" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                            <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                          No recent cashflow data yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <CategoryChart data={categoryBreakdown} />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <PaymentMethodChart
                    data={paymentBreakdown.map((item) => ({
                      method: item.method,
                      count: item.transactionCount,
                      amount: item.amount,
                    }))}
                  />
                  <Card className="border border-border/70 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Top Merchants</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Highest spending destinations this month
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Merchant</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topMerchants.map((merchant) => (
                            <TableRow key={merchant.merchant}>
                              <TableCell className="font-medium">
                                {merchant.merchant || "Unknown"}
                              </TableCell>
                              <TableCell>{merchant.primaryCategory}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(merchant.totalAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-border/70">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Transactions</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Latest activity across all accounts
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/transactions">View all</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.length > 0 ? (
                          recentTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {new Date(transaction.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {transaction.description}
                              </TableCell>
                              <TableCell>{transaction.category}</TableCell>
                              <TableCell className="text-right font-semibold">
                                <span
                                  className={
                                    transaction.type === "income"
                                      ? "text-emerald-600"
                                      : "text-rose-600"
                                  }
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrency(transaction.amount)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No transactions available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <AiInsightsWidget compact />
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
