"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MonthlyMetrics } from "@/lib/monthly-utils"
import { IconTrendingUp, IconTrendingDown, IconAlertCircle, IconCoin, IconReceipt, IconPigMoney } from "@tabler/icons-react"

interface MonthlySummaryCardProps {
  metrics: MonthlyMetrics
}

export function MonthlySummaryCard({ metrics }: MonthlySummaryCardProps) {
  const isPositiveGrowth = metrics.netChange >= 0
  const isPartialMonth = metrics.isPartialMonth

  return (
    <Card className="col-span-full border border-border/70">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Monthly Summary</CardTitle>
            <CardDescription>Snapshot for {metrics.monthLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border/60">
              {metrics.monthLabel}
            </Badge>
            {isPartialMonth && (
              <Badge variant="secondary" className="border border-warning/30 bg-warning/10 text-warning-foreground">
                <IconAlertCircle className="mr-1 size-3" />
                Partial Month
              </Badge>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {isPartialMonth
            ? `${metrics.daysInPeriod} days • ${metrics.startDate.toLocaleDateString()} - ${metrics.endDate.toLocaleDateString()}`
            : "Full month coverage"}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="mt-2 text-2xl font-semibold">₹{metrics.openingBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Closing Balance</p>
            <p className="mt-2 text-2xl font-semibold">₹{metrics.closingBalance.toLocaleString()}</p>
          </div>
          <div className={`rounded-lg border p-4 ${
            isPositiveGrowth
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-rose-500/30 bg-rose-500/5"
          }`}>
            <p className="text-xs text-muted-foreground">Net Change</p>
            <div className="mt-2 flex items-center gap-2">
              <p className={`text-2xl font-semibold ${isPositiveGrowth ? "text-emerald-600" : "text-rose-600"}`}>
                {isPositiveGrowth ? "+" : ""}₹{metrics.netChange.toLocaleString()}
              </p>
              {isPositiveGrowth ? (
                <IconTrendingUp className="size-5 text-emerald-600" />
              ) : (
                <IconTrendingDown className="size-5 text-rose-600" />
              )}
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${
            isPositiveGrowth
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-rose-500/30 bg-rose-500/5"
          }`}>
            <p className="text-xs text-muted-foreground">Growth Rate</p>
            <p className={`mt-2 text-2xl font-semibold ${isPositiveGrowth ? "text-emerald-600" : "text-rose-600"}`}>
              {metrics.growthRate.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="mt-2 text-xl font-semibold">₹{metrics.totalIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics.incomeTransactionCount} transactions</p>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="mt-2 text-xl font-semibold">₹{metrics.totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics.expenseTransactionCount} transactions</p>
          </div>
          <div className={`rounded-lg border p-4 ${
            metrics.savingsRate >= 0
              ? "border-border/60"
              : "border-rose-500/30 bg-rose-500/5"
          }`}>
            <p className="text-xs text-muted-foreground">
              {metrics.savingsRate < 0 ? "Overspend Rate" : "Savings Rate"}
            </p>
            <p className={`mt-2 text-xl font-semibold ${metrics.savingsRate < 0 ? "text-rose-600" : ""}`}>
              {metrics.savingsRate < 0
                ? `Overspent by ${Math.abs(metrics.savingsRate).toFixed(1)}%`
                : `${metrics.savingsRate.toFixed(1)}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.savingsRate < 0 ? "Expenses exceed income" : "Of income saved"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
