"use client"

import * as React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { IconPigMoney, IconTrendingDown, IconTrendingUp, IconWallet } from "@tabler/icons-react"

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
  MonthIdentifier,
} from "@/lib/monthly-utils"
import { calculateAccountSummary, calculateBalanceTrend } from "@/lib/balance-utils"
import { isCompletedStatus, toDate } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MonthSelector } from "@/components/month-selector"
import { MonthlySummaryCard } from "@/components/monthly-summary-card"
import { WeeklyAnalyticsContent } from "@/components/weekly-analytics-content"
import { CategoryChart } from "@/components/category-chart"
import { PaymentMethodChart } from "@/components/payment-method-chart"
import { MetricTile } from "@/components/metric-tile"
import { DataAudit } from "@/components/data-audit"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
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
    // Remove one-time large expenses from the transaction set
    const oneTimeIds = new Set(separatedExpenses.oneTime.map((t) => t.id))
    return monthTransactions.filter((t) => !oneTimeIds.has(t.id))
  }, [monthTransactions, excludeOneTime, separatedExpenses])

  const analytics = effectiveTransactions.length > 0
    ? calculateAnalytics(effectiveTransactions)
    : null
  const monthlyTrends = calculateMonthlyTrends(transactions)
  const dailyTrends = calculateDailyTrends(effectiveTransactions)
  const categoryBreakdown = calculateCategoryBreakdown(effectiveTransactions)
  const accountSummary = calculateAccountSummary(transactions)
  const balanceTrend = calculateBalanceTrend(monthTransactions)
  const showBalanceTrendDots = balanceTrend.length <= 1
  const hasOneTimeExpenses = separatedExpenses.oneTime.length > 0

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
          title="Analytics Studio"
          subtitle="Deep insights across daily, weekly, monthly, and yearly views"
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
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-96" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label="Account Balance"
                    value={formatCurrency(accountSummary.currentBalance)}
                    trendLabel={`Opening: ${formatCurrency(accountSummary.openingBalance)}`}
                    change={accountSummary.openingBalance !== 0 ? (accountSummary.netChange / Math.abs(accountSummary.openingBalance)) * 100 : 0}
                    tone={accountSummary.netChange >= 0 ? "positive" : "negative"}
                    icon={<IconWallet className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Monthly Income"
                    value={formatCurrency(analytics?.totalIncome || 0)}
                    trendLabel={selectedMonth.label}
                    icon={<IconTrendingUp className="h-5 w-5" />}
                    tone="positive"
                  />
                  <MetricTile
                    label="Monthly Expenses"
                    value={formatCurrency(analytics?.totalExpenses || 0)}
                    trendLabel={selectedMonth.label}
                    icon={<IconTrendingDown className="h-5 w-5" />}
                    tone="negative"
                  />
                  <MetricTile
                    label={(analytics?.savingsRate ?? 0) < 0 ? "Overspend Rate" : "Savings Rate"}
                    value={
                      (analytics?.savingsRate ?? 0) < 0
                        ? `Overspent by ${Math.abs(analytics?.savingsRate ?? 0).toFixed(1)}%`
                        : `${(analytics?.savingsRate ?? 0).toFixed(1)}%`
                    }
                    trendLabel="Month to date"
                    icon={<IconPigMoney className="h-5 w-5" />}
                    tone={(analytics?.savingsRate ?? 0) >= 0 ? "positive" : "negative"}
                  />
                </div>

                {hasOneTimeExpenses && (
                  <Card className="border border-border/70">
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Large one-time expenses detected
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {separatedExpenses.oneTime.length} transaction{separatedExpenses.oneTime.length > 1 ? "s" : ""} above {formatCurrency(50000)} totalling{" "}
                          {formatCurrency(separatedExpenses.oneTimeTotal)} ({((separatedExpenses.oneTimeTotal / separatedExpenses.totalExpenses) * 100).toFixed(1)}% of all expenses)
                        </p>
                      </div>
                      <Button
                        variant={excludeOneTime ? "default" : "outline"}
                        size="sm"
                        onClick={() => setExcludeOneTime((prev) => !prev)}
                      >
                        {excludeOneTime ? "Showing recurring only" : "Show recurring only"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Tabs defaultValue="snapshot" className="space-y-4">
                  <TabsList className="flex flex-wrap gap-2">
                    <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  <TabsTrigger value="audit">Data Audit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="snapshot" className="space-y-4">
                    <MonthlySummaryCard metrics={monthlyMetrics} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="border border-border/70">
                        <CardHeader>
                          <CardTitle>Balance Trend</CardTitle>
                          <CardDescription>Selected month balance trend</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart
                              data={balanceTrend.map((bt) => ({
                                date: bt.date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }),
                                balance: bt.balance,
                              }))}
                            >
                              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="#0ea5e9"
                                strokeWidth={3}
                                strokeOpacity={0.95}
                                connectNulls
                                isAnimationActive={false}
                                dot={showBalanceTrendDots ? { r: 4, fill: "#0ea5e9" } : false}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      <PaymentMethodChart
                        data={(analytics?.paymentMethodBreakdown || []).map((pm) => ({
                          method: pm.method,
                          count: pm.transactionCount,
                          amount: pm.amount,
                        }))}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="daily" className="space-y-4">
                    <Card className="border border-border/70">
                      <CardHeader>
                        <CardTitle>Daily Cashflow</CardTitle>
                        <CardDescription>Income and expenses by day</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={dailyTrends.map((item) => ({
                            date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                            income: item.income,
                            expenses: item.expenses,
                          }))}>
                            <defs>
                              <linearGradient id="dailyIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                              </linearGradient>
                              <linearGradient id="dailyExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#dailyIncome)" strokeWidth={3} strokeOpacity={0.95} isAnimationActive={false} />
                            <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="url(#dailyExpense)" strokeWidth={3} strokeOpacity={0.95} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card className="border border-border/70">
                      <CardHeader>
                        <CardTitle>Daily Highlights</CardTitle>
                        <CardDescription>Average and peak day insights</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-border/70 p-4">
                          <p className="text-xs text-muted-foreground">Average Daily Spend</p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(analytics?.dailyAverageSpend || 0)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 p-4">
                          <p className="text-xs text-muted-foreground">Transactions</p>
                          <p className="text-xl font-semibold">{monthTransactions.length}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 p-4">
                          <p className="text-xs text-muted-foreground">Selected Month</p>
                          <p className="text-xl font-semibold">{selectedMonth.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="weekly" className="space-y-4">
                    <WeeklyAnalyticsContent transactions={transactions} />
                  </TabsContent>

                  <TabsContent value="monthly" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="border border-border/70">
                        <CardHeader>
                          <CardTitle>Monthly Trends</CardTitle>
                          <CardDescription>Income and expenses across months</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={monthlyTrends}>
                              <defs>
                                <linearGradient id="monthIncome" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="monthExpense" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="monthName" tickLine={false} axisLine={false} tickMargin={8} />
                              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#monthIncome)" strokeWidth={3} strokeOpacity={0.95} isAnimationActive={false} />
                              <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="url(#monthExpense)" strokeWidth={3} strokeOpacity={0.95} isAnimationActive={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      <CategoryChart data={categoryBreakdown} />
                    </div>
                  </TabsContent>

                  <TabsContent value="yearly" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border border-border/70">
                        <CardHeader>
                          <CardTitle>Year Over Year</CardTitle>
                          <CardDescription>
                            Current year vs last year
                            {yoyGrowth.isAnnualized && (
                              <Badge variant="secondary" className="ml-2 text-xs">Annualized</Badge>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Income Growth</span>
                            <Badge variant="outline">{yoyGrowth.incomeGrowth.toFixed(1)}%</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Expense Growth</span>
                            <Badge variant="outline">{yoyGrowth.expenseGrowth.toFixed(1)}%</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Savings Growth</span>
                            <Badge variant="outline">{yoyGrowth.savingsGrowth.toFixed(1)}%</Badge>
                          </div>
                          {yoyGrowth.isAnnualized && (
                            <p className="text-xs text-muted-foreground pt-1">
                              * Current year data is annualized (projected to full year based on months elapsed)
                            </p>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="border border-border/70 md:col-span-2">
                        <CardHeader>
                          <CardTitle>Annual Performance</CardTitle>
                          <CardDescription>Income vs expenses by year</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={yearlyData}>
                              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="year" tickLine={false} axisLine={false} />
                              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Line
                                type="monotone"
                                dataKey="income"
                                stroke="#0ea5e9"
                                strokeWidth={3}
                                strokeOpacity={0.95}
                                connectNulls
                                isAnimationActive={false}
                                dot={showYearlyDots ? { r: 4, fill: "#0ea5e9" } : false}
                                activeDot={{ r: 5 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="expenses"
                                stroke="#f97316"
                                strokeWidth={3}
                                strokeOpacity={0.95}
                                connectNulls
                                isAnimationActive={false}
                                dot={showYearlyDots ? { r: 4, fill: "#f97316" } : false}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-4">
                    <DataAudit transactions={transactions} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
