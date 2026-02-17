"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconSparkles,
  IconRefresh,
  IconArrowRight,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconAlertTriangle,
  IconCircleCheck,
  IconBolt,
  IconBulb,
} from "@tabler/icons-react"

import { useAiInsight } from "@/hooks/use-ai-insights"
import { InsightMarkdown } from "@/components/insight-markdown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR, formatCompact } from "@/lib/format"

/* ─── Types matching SpendingAnalysisData from ai-types.ts ─── */

interface SpendingAnalysisData {
  healthScore: number
  summary: {
    income: number
    expenses: number
    savings: number
    savingsRate: number
    verdict: string
  }
  topCategories: Array<{
    name: string
    amount: number
    percentage: number
    trend: "up" | "down" | "stable"
    suggestion?: string
  }>
  actionItems: Array<{
    title: string
    description: string
    impact: "high" | "medium" | "low"
    savingAmount: number
    category: string
  }>
  alerts: Array<{
    type: "warning" | "critical" | "positive"
    title: string
    message: string
  }>
  keyInsight: string
}

/* ─── Action item link mapping ─── */

const ACTION_LINK_MAP: Record<string, string> = {
  budget: "/budget",
  food: "/budget",
  groceries: "/budget",
  dining: "/budget",
  entertainment: "/budget",
  shopping: "/budget",
  transport: "/budget",
  travel: "/budget",
  subscriptions: "/budget",
  utilities: "/budget",
  investment: "/investments",
  investments: "/investments",
  mutual: "/investments",
  stocks: "/investments",
  sip: "/investments",
  savings: "/goals",
  goals: "/goals",
  emergency: "/goals",
  tax: "/tax",
  insurance: "/tax",
  deduction: "/tax",
}

function getActionLink(category: string, title: string): string {
  const combined = `${category} ${title}`.toLowerCase()
  for (const [keyword, link] of Object.entries(ACTION_LINK_MAP)) {
    if (combined.includes(keyword)) return link
  }
  return "/ai-insights"
}

/* ─── Health Score Badge ─── */

function HealthScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
      : score >= 40
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20"

  const label =
    score >= 70 ? "Healthy" : score >= 40 ? "Needs Work" : "At Risk"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${color}`}
    >
      <span className="text-sm font-bold">{score}</span>
      <span className="text-[10px] font-medium opacity-80">/100</span>
      <span className="mx-0.5 h-3 w-px bg-current opacity-20" />
      <span>{label}</span>
    </span>
  )
}

/* ─── Compact Category Chip ─── */

const TREND_ICONS = {
  up: IconTrendingUp,
  down: IconTrendingDown,
  stable: IconMinus,
} as const

const TREND_COLORS = {
  up: "text-rose-500",
  down: "text-emerald-500",
  stable: "text-muted-foreground",
} as const

function CategoryChip({
  name,
  amount,
  percentage,
  trend,
}: {
  name: string
  amount: number
  percentage: number
  trend: "up" | "down" | "stable"
}) {
  const TrendIcon = TREND_ICONS[trend]
  const trendColor = TREND_COLORS[trend]

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
      <span className="font-medium truncate max-w-[100px]">{name}</span>
      <span className="font-semibold tabular-nums text-foreground/80">
        {formatCompact(amount)}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {percentage.toFixed(0)}%
      </span>
      <TrendIcon className={`h-3 w-3 shrink-0 ${trendColor}`} />
    </div>
  )
}

/* ─── Impact badge color ─── */

const IMPACT_STYLES = {
  high: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/15",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/15",
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/15",
} as const

/* ─── Alert badge config ─── */

const ALERT_STYLES = {
  warning: {
    bg: "bg-amber-500/5 border-amber-500/15",
    icon: IconAlertTriangle,
    iconColor: "text-amber-500",
  },
  critical: {
    bg: "bg-rose-500/5 border-rose-500/15",
    icon: IconAlertTriangle,
    iconColor: "text-rose-500",
  },
  positive: {
    bg: "bg-emerald-500/5 border-emerald-500/15",
    icon: IconCircleCheck,
    iconColor: "text-emerald-500",
  },
} as const

/* ─── Action Item Card ─── */

function ActionItemCard({
  title,
  description,
  impact,
  savingAmount,
  category,
}: SpendingAnalysisData["actionItems"][number]) {
  const link = getActionLink(category, title)
  const impactStyle = IMPACT_STYLES[impact]

  return (
    <Link
      href={link}
      className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:bg-muted/40 hover:border-border"
    >
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <IconBolt className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
            {title}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${impactStyle}`}
          >
            {impact}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {description}
        </p>
        {savingAmount > 0 && (
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
            Potential saving: {formatINR(savingAmount)}
          </p>
        )}
      </div>
      <IconArrowRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

/* ─── Structured Spending Insights View ─── */

function StructuredInsightsView({
  data,
  compact,
}: {
  data: SpendingAnalysisData
  compact: boolean
}) {
  const categories = compact
    ? data.topCategories?.slice(0, 4)
    : data.topCategories
  const actions = compact
    ? data.actionItems?.slice(0, 3)
    : data.actionItems
  const alerts = compact
    ? data.alerts?.slice(0, 2)
    : data.alerts

  return (
    <div className="space-y-4">
      {/* Health Score + Key Insight */}
      <div className="flex items-start gap-3">
        <HealthScoreBadge score={data.healthScore} />
        {data.keyInsight && (
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <IconBulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {data.keyInsight}
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats Row */}
      {data.summary && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-muted-foreground">
            Income{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatCompact(data.summary.income)}
            </strong>
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">
            Spent{" "}
            <strong className="text-rose-600 dark:text-rose-400">
              {formatCompact(data.summary.expenses)}
            </strong>
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">
            Saved{" "}
            <strong className="text-blue-600 dark:text-blue-400">
              {data.summary.savingsRate.toFixed(0)}%
            </strong>
          </span>
          {data.summary.verdict && (
            <>
              <span className="h-3 w-px bg-border" />
              <span className="text-muted-foreground italic">
                {data.summary.verdict}
              </span>
            </>
          )}
        </div>
      )}

      {/* Top Categories */}
      {categories && categories.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Top Categories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <CategoryChip key={cat.name} {...cat} />
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert, i) => {
            const style = ALERT_STYLES[alert.type]
            const AlertIcon = style.icon
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${style.bg}`}
              >
                <AlertIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${style.iconColor}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action Items */}
      {actions && actions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Recommendations
          </p>
          <div className="space-y-2">
            {actions.map((action, i) => (
              <ActionItemCard key={i} {...action} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Widget ─── */

interface AiInsightsWidgetProps {
  compact?: boolean
}

export function AiInsightsWidget({ compact = false }: AiInsightsWidgetProps) {
  const insight = useAiInsight("spending_analysis")

  const structuredData = React.useMemo(() => {
    if (!insight.structuredData) return null
    const sd = insight.structuredData as unknown as SpendingAnalysisData
    // Validate it has the expected shape
    if (typeof sd.healthScore === "number" && sd.topCategories) {
      return sd
    }
    return null
  }, [insight.structuredData])

  // Fallback: truncate content for compact widget view
  const displayText = React.useMemo(() => {
    if (!insight.content) return null
    if (!compact) return insight.content
    const truncated = insight.content.slice(0, 300)
    const lastNewline = truncated.lastIndexOf("\n")
    return (lastNewline > 100 ? truncated.slice(0, lastNewline) : truncated) + "..."
  }, [insight.content, compact])

  const isWorking = insight.isLoading || insight.isRegenerating

  return (
    <Card className="border border-border/70">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">AI Insights</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={insight.regenerate}
            disabled={isWorking}
            className="h-8 px-2"
          >
            <IconRefresh className={`h-4 w-4 ${isWorking ? "animate-spin" : ""}`} />
            <span className="ml-1 text-xs">Refresh</span>
          </Button>
          {compact && (
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link href="/ai-insights">
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {insight.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : insight.error && !insight.content && !structuredData ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950">
            <p className="text-sm text-rose-700 dark:text-rose-300">{insight.error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure OPENROUTER_API_KEY is configured in your .env.local
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={insight.regenerate}
            >
              <IconRefresh className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : structuredData ? (
          <div>
            <StructuredInsightsView data={structuredData} compact={compact} />
            {insight.generatedAt && (
              <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/40">
                Generated{" "}
                {new Date(insight.generatedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {insight.stale && (
                  <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                    (stale -- refresh for latest)
                  </span>
                )}
              </p>
            )}
          </div>
        ) : displayText ? (
          <div className="space-y-2">
            <InsightMarkdown content={displayText} />
            {insight.generatedAt && (
              <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/40">
                Generated{" "}
                {new Date(insight.generatedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {insight.stale && (
                  <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                    (stale -- refresh for latest)
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
