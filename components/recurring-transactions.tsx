"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  IconCalendarDue,
  IconRepeat,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react"

import { formatINR as formatCurrency } from "@/lib/format"
import { fadeUp, fadeUpSmall, listItem, stagger } from "@/lib/motion"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

import type { RecurringPattern } from "@/lib/recurring-detector"

interface RecurringTransactionsProps {
  compact?: boolean
}

type PatternStatus = "active" | "changed" | "overdue"

function getPatternStatus(pattern: RecurringPattern): PatternStatus {
  const now = new Date()
  const nextDate = new Date(pattern.nextExpectedDate)

  // Overdue: next expected date is in the past
  if (nextDate < now) return "overdue"

  // Changed: amount variance > 15%
  if (pattern.amountVariance > 15) return "changed"

  return "active"
}

function getStatusColor(status: PatternStatus) {
  switch (status) {
    case "active":
      return {
        dot: "bg-emerald-500",
        badge: "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      }
    case "changed":
      return {
        dot: "bg-amber-500",
        badge: "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      }
    case "overdue":
      return {
        dot: "bg-rose-500",
        badge: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
      }
  }
}

function frequencyLabel(freq: RecurringPattern["frequency"]): string {
  switch (freq) {
    case "weekly": return "Weekly"
    case "biweekly": return "Bi-weekly"
    case "monthly": return "Monthly"
    case "quarterly": return "Quarterly"
    case "annual": return "Annual"
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  })
}

export function RecurringTransactions({ compact = false }: RecurringTransactionsProps) {
  const [patterns, setPatterns] = React.useState<RecurringPattern[]>([])
  const [upcomingTotal, setUpcomingTotal] = React.useState(0)
  const [upcomingCount, setUpcomingCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/transactions/recurring", {
          credentials: "include",
        })
        const data = await res.json()
        if (data.success) {
          setPatterns(data.patterns || [])
          setUpcomingTotal(data.upcoming?.total || 0)
          setUpcomingCount(data.upcoming?.count || 0)
        }
      } catch {
        // silent fail
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="card-elevated rounded-xl bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="card-elevated rounded-xl bg-card p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted/60">
            <IconRepeat className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Recurring Transactions</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Not enough data to detect recurring patterns yet.
        </p>
      </div>
    )
  }

  const displayPatterns = compact ? patterns.slice(0, 5) : patterns

  // Upcoming patterns (next 7 days)
  const now = new Date()
  const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000)
  const upcoming = patterns.filter((p) => {
    const next = new Date(p.nextExpectedDate)
    return next >= now && next <= sevenDaysOut
  })

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="card-elevated rounded-xl bg-card p-5"
    >
      {/* Header */}
      <motion.div variants={fadeUpSmall} className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-500/10">
            <IconRepeat className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold">Recurring Transactions</h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {patterns.length} detected
        </span>
      </motion.div>

      {/* Upcoming Summary */}
      {upcomingCount > 0 && (
        <motion.div
          variants={fadeUpSmall}
          className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-3.5 py-2.5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCalendarDue className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {upcomingCount} upcoming in next 7 days
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {formatCurrency(upcomingTotal)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Pattern List */}
      <div className="space-y-2">
        {displayPatterns.map((pattern, i) => {
          const status = getPatternStatus(pattern)
          const colors = getStatusColor(status)
          const anim = listItem(i)

          return (
            <motion.div
              key={`${pattern.merchant}-${pattern.frequency}`}
              initial={anim.initial}
              animate={anim.animate}
              transition={anim.transition}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors -mx-1"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {pattern.merchant}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground/60">
                      {frequencyLabel(pattern.frequency)}
                    </span>
                    {pattern.isSubscription && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-violet-500/30 text-violet-600 dark:text-violet-400"
                      >
                        Sub
                      </Badge>
                    )}
                    {!compact && (
                      <span className="text-[10px] text-muted-foreground/50">
                        Next: {formatDate(pattern.nextExpectedDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!compact && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${colors.badge}`}
                  >
                    {status === "active" && <IconCheck className="h-2.5 w-2.5 mr-0.5" />}
                    {status === "changed" && <IconAlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                    {status === "overdue" && <IconAlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                    {status}
                  </Badge>
                )}
                <span className="text-[13px] font-semibold tabular-nums">
                  {formatCurrency(pattern.averageAmount)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Show more indicator in compact mode */}
      {compact && patterns.length > 5 && (
        <p className="text-xs text-muted-foreground text-center mt-3 pt-2 border-t border-border/30">
          +{patterns.length - 5} more recurring transactions
        </p>
      )}

      {/* Summary footer in expanded mode */}
      {!compact && patterns.length > 0 && (
        <motion.div
          variants={fadeUpSmall}
          className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground">
            Total recurring monthly estimate
          </span>
          <span className="text-sm font-bold tabular-nums">
            {formatCurrency(
              patterns.reduce((sum, p) => {
                // Normalize to monthly
                switch (p.frequency) {
                  case "weekly": return sum + p.averageAmount * 4.33
                  case "biweekly": return sum + p.averageAmount * 2.17
                  case "monthly": return sum + p.averageAmount
                  case "quarterly": return sum + p.averageAmount / 3
                  case "annual": return sum + p.averageAmount / 12
                }
              }, 0)
            )}
          </span>
        </motion.div>
      )}
    </motion.div>
  )
}
