"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import {
  calculateWeeklyMetrics,
  formatWeekDateRange,
  getAvailableWeeks,
  getCurrentWeek,
  getNextWeek,
  getPreviousWeek,
  getWeekEndDate,
  getWeekStartDate,
  getWeekTransactions,
  WeekIdentifier,
} from "@/lib/weekly-utils"
import { getBalanceAtDate } from "@/lib/balance-utils"
import { TransactionCategory } from "@/lib/types"
import { isCompletedStatus } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { PeriodBridge } from "@/components/period-bridge"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function WeeklyAnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { transactions, isLoading: transactionsLoading } = useTransactions()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  const availableWeeks = useMemo(
    () => getAvailableWeeks(transactions),
    [transactions]
  )

  const [selectedWeekLabel, setSelectedWeekLabel] = useState<string | null>(null)

  const fallbackWeek = useMemo<WeekIdentifier>(
    () => (availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : getCurrentWeek()),
    [availableWeeks]
  )

  const selectedWeek = useMemo<WeekIdentifier>(() => {
    if (!selectedWeekLabel) return fallbackWeek
    return availableWeeks.find((w) => w.label === selectedWeekLabel) || fallbackWeek
  }, [availableWeeks, fallbackWeek, selectedWeekLabel])

  const weekTransactions = useMemo(
    () => getWeekTransactions(transactions, selectedWeek.year, selectedWeek.weekNumber),
    [transactions, selectedWeek]
  )

  const weeklyMetrics = useMemo(
    () => calculateWeeklyMetrics(transactions, selectedWeek.year, selectedWeek.weekNumber),
    [transactions, selectedWeek]
  )

  const weekStart = getWeekStartDate(selectedWeek.year, selectedWeek.weekNumber)
  const weekEnd = getWeekEndDate(selectedWeek.year, selectedWeek.weekNumber)
  const openingBalance = getBalanceAtDate(
    transactions,
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 1)
  )
  const closingBalance = getBalanceAtDate(transactions, weekEnd)

  const dailyBreakdown = useMemo(() => {
    const days: Record<string, { date: string; income: number; expenses: number }> = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      const key = date.toLocaleDateString("en-CA")
      days[key] = {
        date: date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
        income: 0,
        expenses: 0,
      }
    }

    weekTransactions.forEach((t) => {
      const key = new Date(t.date).toLocaleDateString("en-CA")
      if (!days[key] || !isCompletedStatus(t.status)) return
      if (t.type === "income") days[key].income += t.amount
      if (t.type === "expense") days[key].expenses += t.amount
    })

    return Object.values(days)
  }, [weekTransactions, weekStart])

  const topExpenses = useMemo(() => {
    return weekTransactions
      .filter((t) => t.type === "expense" && isCompletedStatus(t.status))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
  }, [weekTransactions])

  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<TransactionCategory, number>()
    weekTransactions
      .filter((t) => t.type === "expense" && isCompletedStatus(t.status))
      .forEach((t) => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount)
      })
    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [weekTransactions])

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
          title="Weekly Analytics"
          subtitle="Balance-aware breakdown of weekly performance"
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{weeklyMetrics.weekLabel}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatWeekDateRange(selectedWeek.year, selectedWeek.weekNumber)}
                </p>
              </div>
              {availableWeeks.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedWeekLabel(getPreviousWeek(selectedWeek).label)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={selectedWeek.label}
                    onValueChange={(value) => setSelectedWeekLabel(value)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWeeks.map((week) => (
                        <SelectItem key={`${week.year}-${week.weekNumber}`} value={week.label}>
                          <div className="flex items-center gap-2">
                            {week.label}
                            {week.label === getCurrentWeek().label && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedWeekLabel(getNextWeek(selectedWeek).label)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-80" />
              </div>
            ) : (
              <>
                <PeriodBridge
                  title="Week Reference"
                  periodLabel={selectedWeek.label}
                  openingBalance={openingBalance}
                  inflow={weeklyMetrics.totalIncome}
                  outflow={weeklyMetrics.totalExpenses}
                  closingBalance={closingBalance}
                />

                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="card-elevated">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Income</p>
                      <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(weeklyMetrics.totalIncome)}</p>
                      <p className="text-xs text-muted-foreground">{weeklyMetrics.incomeTransactionCount} entries</p>
                    </CardContent>
                  </Card>
                  <Card className="card-elevated">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="text-2xl font-semibold text-rose-600">{formatCurrency(weeklyMetrics.totalExpenses)}</p>
                      <p className="text-xs text-muted-foreground">{weeklyMetrics.expenseTransactionCount} entries</p>
                    </CardContent>
                  </Card>
                  <Card className="card-elevated">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Net Change</p>
                      <p className={`text-2xl font-semibold ${(weeklyMetrics.totalIncome - weeklyMetrics.totalExpenses) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {(weeklyMetrics.totalIncome - weeklyMetrics.totalExpenses) >= 0 ? "+" : ""}{formatCurrency(weeklyMetrics.totalIncome - weeklyMetrics.totalExpenses)}
                      </p>
                      <p className="text-xs text-muted-foreground">Balance change this week</p>
                    </CardContent>
                  </Card>
                  <Card className="card-elevated">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Average Daily Spend</p>
                      <p className="text-2xl font-semibold">{formatCurrency(weeklyMetrics.averageDailySpend)}</p>
                      <p className="text-xs text-muted-foreground">{weeklyMetrics.daysInWeek} active days</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="card-elevated">
                    <CardHeader>
                      <CardTitle>Daily Breakdown</CardTitle>
                      <CardDescription>Income vs expenses by day</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={dailyBreakdown}>
                          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)" }} />
                          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} tick={{ fill: "var(--muted-foreground)" }} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              borderRadius: 10,
                              fontSize: 12,
                              border: "1px solid var(--border)",
                              background: "var(--card)",
                              color: "var(--card-foreground)",
                            }}
                            cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                          />
                          <Bar dataKey="income" fill="var(--chart-1)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          <Bar dataKey="expenses" fill="var(--chart-5)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="card-elevated">
                    <CardHeader>
                      <CardTitle>Top Categories</CardTitle>
                      <CardDescription>Highest weekly spend areas</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {categoryBreakdown.length > 0 ? (
                        categoryBreakdown.map((item) => (
                          <div key={item.category} className="flex items-center justify-between">
                            <div className="text-sm font-medium">{item.category}</div>
                            <Badge variant="outline">{formatCurrency(item.amount)}</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No expenses this week.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Top Expenses</CardTitle>
                    <CardDescription>Largest transactions this week</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topExpenses.length > 0 ? (
                      topExpenses.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                          <div>
                            <p className="font-medium">{txn.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {txn.merchant} · {txn.category}
                            </p>
                          </div>
                          <span className="text-rose-600 font-semibold">
                            {formatCurrency(txn.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No expenses this week.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
