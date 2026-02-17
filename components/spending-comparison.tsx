"use client"

import * as React from "react"
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
  IconArrowUpRight,
  IconArrowDownRight,
  IconTrendingUp,
  IconTrendingDown,
} from "@tabler/icons-react"

import type { Transaction } from "@/lib/types"
import { formatINR as formatCurrency, formatCompactAxis } from "@/lib/format"
import { fadeUp, fadeUpSmall, stagger, listItem } from "@/lib/motion"
import { Badge } from "@/components/ui/badge"

interface SpendingComparisonProps {
  transactions: Transaction[]
}

interface CategoryComparison {
  category: string
  current: number
  previous: number
  change: number // absolute change
  changePercent: number
}

function getMonthTransactions(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  return transactions.filter((t) => {
    const d = new Date(t.date as unknown as string)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
}

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
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SpendingComparison({ transactions }: SpendingComparisonProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let prevYear = currentYear
  let prevMonth = currentMonth - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }

  const currentLabel = new Date(currentYear, currentMonth - 1).toLocaleDateString(
    "en-US",
    { month: "short" }
  )
  const prevLabel = new Date(prevYear, prevMonth - 1).toLocaleDateString(
    "en-US",
    { month: "short" }
  )

  const currentTxns = getMonthTransactions(transactions, currentYear, currentMonth)
  const prevTxns = getMonthTransactions(transactions, prevYear, prevMonth)

  const currentExpenses = currentTxns.filter((t) => t.type === "expense")
  const prevExpenses = prevTxns.filter((t) => t.type === "expense")

  const currentTotal = currentExpenses.reduce((s, t) => s + t.amount, 0)
  const prevTotal = prevExpenses.reduce((s, t) => s + t.amount, 0)
  const totalChange = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0

  // Build category comparisons
  const catMap = new Map<string, { current: number; previous: number }>()

  for (const t of currentExpenses) {
    const cat = String(t.category)
    const existing = catMap.get(cat) || { current: 0, previous: 0 }
    existing.current += t.amount
    catMap.set(cat, existing)
  }
  for (const t of prevExpenses) {
    const cat = String(t.category)
    const existing = catMap.get(cat) || { current: 0, previous: 0 }
    existing.previous += t.amount
    catMap.set(cat, existing)
  }

  const comparisons: CategoryComparison[] = Array.from(catMap.entries())
    .map(([category, values]) => ({
      category,
      current: values.current,
      previous: values.previous,
      change: values.current - values.previous,
      changePercent:
        values.previous > 0
          ? ((values.current - values.previous) / values.previous) * 100
          : values.current > 0
            ? 100
            : 0,
    }))
    .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous))

  const chartData = comparisons.slice(0, 10)

  // Find biggest increase and decrease
  const withPrev = comparisons.filter((c) => c.previous > 0)
  const biggestIncrease = withPrev.reduce(
    (max, c) => (c.changePercent > (max?.changePercent ?? -Infinity) ? c : max),
    null as CategoryComparison | null
  )
  const biggestDecrease = withPrev.reduce(
    (min, c) => (c.changePercent < (min?.changePercent ?? Infinity) ? c : min),
    null as CategoryComparison | null
  )

  if (comparisons.length === 0) {
    return (
      <div className="card-elevated rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted/60">
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Spending Comparison</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-6">
          Need at least 2 months of data for comparison.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Summary Cards */}
      <motion.div
        variants={fadeUp}
        className="card-elevated rounded-2xl bg-card grid grid-cols-1 @lg:grid-cols-3 divide-y @lg:divide-y-0 @lg:divide-x divide-border/40"
      >
        {/* Current Month */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
            {currentLabel} Spending
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight">
            {formatCurrency(currentTotal)}
          </p>
        </div>

        {/* Previous Month */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
            {prevLabel} Spending
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight text-muted-foreground">
            {formatCurrency(prevTotal)}
          </p>
        </div>

        {/* Change */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-none mb-1.5">
            Change
          </p>
          <div className="flex items-center gap-2">
            <p
              className={`text-lg font-bold tabular-nums leading-tight ${
                totalChange <= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {totalChange > 0 ? "+" : ""}
              {totalChange.toFixed(1)}%
            </p>
            {totalChange <= 0 ? (
              <IconArrowDownRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <IconArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>
        </div>
      </motion.div>

      {/* Highlights */}
      {(biggestIncrease || biggestDecrease) && (
        <motion.div variants={fadeUpSmall} className="flex flex-wrap gap-2">
          {biggestIncrease && biggestIncrease.changePercent > 0 && (
            <Badge
              variant="secondary"
              className="text-xs font-medium px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
            >
              <IconTrendingUp className="h-3 w-3 mr-1" />
              Biggest increase: {biggestIncrease.category} (+
              {Math.abs(biggestIncrease.changePercent).toFixed(0)}%)
            </Badge>
          )}
          {biggestDecrease && biggestDecrease.changePercent < 0 && (
            <Badge
              variant="secondary"
              className="text-xs font-medium px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              <IconTrendingDown className="h-3 w-3 mr-1" />
              Biggest decrease: {biggestDecrease.category} (
              {biggestDecrease.changePercent.toFixed(0)}%)
            </Badge>
          )}
        </motion.div>
      )}

      {/* Category-by-Category Comparison */}
      <motion.div variants={fadeUp} className="card-elevated rounded-2xl bg-card p-5">
        <div className="mb-5">
          <h3 className="text-sm font-semibold">Category Comparison</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {currentLabel} vs {prevLabel} by category
          </p>
        </div>

        {/* Bar Chart */}
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              strokeOpacity={0.4}
            />
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
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactAxis}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={52}
            />
            <Tooltip
              content={<ComparisonTooltip />}
              cursor={{ fill: "var(--color-muted)", opacity: 0.3, radius: 4 }}
            />
            <Bar
              dataKey="current"
              name={currentLabel}
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="previous"
              name={prevLabel}
              fill="var(--muted-foreground)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--chart-2)" }}
            />
            <span className="font-medium">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "var(--muted-foreground)" }}
            />
            <span className="font-medium">{prevLabel}</span>
          </div>
        </div>
      </motion.div>

      {/* Detailed List */}
      <motion.div variants={fadeUp} className="card-elevated rounded-2xl bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Detailed Breakdown</h3>
        </div>
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_90px_90px_80px] gap-2 px-2 pb-2 border-b border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Category
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider text-right">
              {currentLabel}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider text-right">
              {prevLabel}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider text-right">
              Change
            </span>
          </div>

          {comparisons.map((comp, i) => {
            const anim = listItem(i)
            const isDecrease = comp.change < 0
            const isIncrease = comp.change > 0

            return (
              <motion.div
                key={comp.category}
                initial={anim.initial}
                animate={anim.animate}
                transition={anim.transition}
                className="grid grid-cols-[1fr_90px_90px_80px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <span className="text-[13px] font-medium truncate">
                  {comp.category}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-right">
                  {formatCurrency(comp.current)}
                </span>
                <span className="text-[13px] tabular-nums text-right text-muted-foreground">
                  {formatCurrency(comp.previous)}
                </span>
                <span
                  className={`text-[12px] font-semibold tabular-nums text-right ${
                    isDecrease
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isIncrease
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {comp.previous > 0
                    ? `${comp.changePercent > 0 ? "+" : ""}${comp.changePercent.toFixed(0)}%`
                    : comp.current > 0
                      ? "New"
                      : "-"}
                </span>
              </motion.div>
            )
          })}

          {/* Summary Row */}
          <div className="grid grid-cols-[1fr_90px_90px_80px] gap-2 px-2 pt-2 mt-1 border-t border-border/40">
            <span className="text-[13px] font-bold">Total</span>
            <span className="text-[13px] font-bold tabular-nums text-right">
              {formatCurrency(currentTotal)}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-right text-muted-foreground">
              {formatCurrency(prevTotal)}
            </span>
            <span
              className={`text-[12px] font-bold tabular-nums text-right ${
                totalChange <= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {totalChange > 0 ? "+" : ""}
              {totalChange.toFixed(0)}%
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
