"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconHeartbeat,
  IconShieldCheck,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
} from "@tabler/icons-react"

import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MetricTile } from "@/components/metric-tile"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseVelocity {
  currentMonthlyAvg: number
  previousMonthlyAvg: number
  changePercent: number
  trend: "increasing" | "decreasing" | "stable"
}

interface ScoreBreakdown {
  savingsRate: number
  emergencyFund: number
  nwiAdherence: number
  investmentRate: number
}

interface NetWorthPoint {
  month: string
  bankBalance: number
  investmentValue: number
  totalNetWorth: number
}

interface IncomeProfile {
  avgMonthlyIncome: number
  incomeStability: number
  isVariable: boolean
  lastIncomeDate: string | null
}

interface FinancialHealthMetrics {
  emergencyFundMonths: number
  emergencyFundTarget: number
  expenseVelocity: ExpenseVelocity
  financialFreedomScore: number
  scoreBreakdown: ScoreBreakdown
  netWorthTimeline: NetWorthPoint[]
  incomeProfile: IncomeProfile
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompactAxis(value: number): string {
  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`
  }
  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`
  }
  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(0)}k`
  }
  return `₹${value.toFixed(0)}`
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600"
  if (score >= 50) return "text-amber-500"
  if (score >= 25) return "text-orange-500"
  return "text-rose-600"
}

function getScoreRingColor(score: number): string {
  if (score >= 75) return "#22c55e"
  if (score >= 50) return "#eab308"
  if (score >= 25) return "#f97316"
  return "#ef4444"
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Excellent"
  if (score >= 50) return "Good"
  if (score >= 25) return "Needs Work"
  return "Critical"
}

function getEmergencyFundColor(months: number): string {
  if (months >= 6) return "emerald"
  if (months >= 3) return "amber"
  return "rose"
}

// ---------------------------------------------------------------------------
// Score Ring Component
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(score, 100) / 100
  const strokeDashoffset = circumference * (1 - progress)
  const color = getScoreRingColor(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Breakdown Item
// ---------------------------------------------------------------------------

function BreakdownItem({
  label,
  score,
  maxScore,
}: {
  label: string
  score: number
  maxScore: number
}) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0
  const colorClass =
    percentage >= 75
      ? "[&>div]:bg-emerald-500"
      : percentage >= 50
        ? "[&>div]:bg-amber-500"
        : percentage >= 25
          ? "[&>div]:bg-orange-500"
          : "[&>div]:bg-rose-500"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {score.toFixed(1)} / {maxScore}
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        className={`h-1.5 ${colorClass}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Config
// ---------------------------------------------------------------------------

const netWorthConfig = {
  bankBalance: {
    label: "Bank Balance",
    color: "#0ea5e9",
  },
  investmentValue: {
    label: "Investments",
    color: "#22c55e",
  },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function FinancialHealthPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [metrics, setMetrics] = useState<FinancialHealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    fetch("/api/financial-health")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMetrics(data.metrics)
        } else {
          setError(data.error || "Failed to load financial health data")
        }
      })
      .catch((err) => {
        console.error("Financial health fetch error:", err)
        setError("Failed to load financial health data")
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

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

  const isLoading = loading

  // Derived values (safe when metrics is null)
  const emergencyColor = metrics
    ? getEmergencyFundColor(metrics.emergencyFundMonths)
    : "rose"
  const emergencyPercent = metrics
    ? Math.min(
        (metrics.emergencyFundMonths / metrics.emergencyFundTarget) * 100,
        100
      )
    : 0
  const stabilityPercent = metrics
    ? Math.round(metrics.incomeProfile.incomeStability * 100)
    : 0

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="Financial Health"
          subtitle="Deep dive into your financial wellness metrics"
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            {isLoading ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <Skeleton className="h-48" />
                <Skeleton className="h-80" />
              </div>
            ) : error ? (
              <Card className="border border-border/70">
                <CardContent className="flex h-64 items-center justify-center">
                  <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent>
              </Card>
            ) : metrics ? (
              <>
                {/* --------------------------------------------------------- */}
                {/* 1. Financial Freedom Score + Score Breakdown              */}
                {/* --------------------------------------------------------- */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconHeartbeat className="h-5 w-5 text-primary" />
                        Financial Freedom Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                      <ScoreRing score={metrics.financialFreedomScore} />
                      <Badge
                        variant="outline"
                        className={`text-sm ${
                          metrics.financialFreedomScore >= 75
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            : metrics.financialFreedomScore >= 50
                              ? "bg-amber-500/10 text-amber-700 border-amber-200"
                              : metrics.financialFreedomScore >= 25
                                ? "bg-orange-500/10 text-orange-700 border-orange-200"
                                : "bg-rose-500/10 text-rose-700 border-rose-200"
                        }`}
                      >
                        {getScoreLabel(metrics.financialFreedomScore)}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle>Score Breakdown</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Each component contributes up to 25 points
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <BreakdownItem
                        label="Savings Rate"
                        score={metrics.scoreBreakdown.savingsRate}
                        maxScore={25}
                      />
                      <BreakdownItem
                        label="Emergency Fund"
                        score={metrics.scoreBreakdown.emergencyFund}
                        maxScore={25}
                      />
                      <BreakdownItem
                        label="NWI Adherence"
                        score={metrics.scoreBreakdown.nwiAdherence}
                        maxScore={25}
                      />
                      <BreakdownItem
                        label="Investment Rate"
                        score={metrics.scoreBreakdown.investmentRate}
                        maxScore={25}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* --------------------------------------------------------- */}
                {/* 2. Metric Tiles Row                                      */}
                {/* --------------------------------------------------------- */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label="Emergency Fund"
                    value={`${metrics.emergencyFundMonths.toFixed(1)} months`}
                    trendLabel={`Target: ${metrics.emergencyFundTarget} months`}
                    change={
                      ((metrics.emergencyFundMonths -
                        metrics.emergencyFundTarget) /
                        metrics.emergencyFundTarget) *
                      100
                    }
                    tone={
                      metrics.emergencyFundMonths >= metrics.emergencyFundTarget
                        ? "positive"
                        : metrics.emergencyFundMonths >= 3
                          ? "neutral"
                          : "negative"
                    }
                    icon={<IconShieldCheck className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Monthly Income"
                    value={formatCurrency(
                      metrics.incomeProfile.avgMonthlyIncome
                    )}
                    trendLabel={
                      metrics.incomeProfile.isVariable
                        ? "Variable income"
                        : "Stable income"
                    }
                    change={stabilityPercent - 100}
                    tone={stabilityPercent >= 70 ? "positive" : "negative"}
                    icon={<IconCash className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Expense Trend"
                    value={`${metrics.expenseVelocity.changePercent >= 0 ? "+" : ""}${metrics.expenseVelocity.changePercent.toFixed(1)}%`}
                    trendLabel="vs previous period"
                    change={metrics.expenseVelocity.changePercent}
                    tone={
                      metrics.expenseVelocity.trend === "decreasing"
                        ? "positive"
                        : metrics.expenseVelocity.trend === "stable"
                          ? "neutral"
                          : "negative"
                    }
                    icon={
                      metrics.expenseVelocity.trend === "decreasing" ? (
                        <IconTrendingDown className="h-5 w-5" />
                      ) : (
                        <IconTrendingUp className="h-5 w-5" />
                      )
                    }
                  />
                  <MetricTile
                    label="Income Stability"
                    value={`${stabilityPercent}%`}
                    trendLabel={
                      metrics.incomeProfile.isVariable ? "Variable" : "Stable"
                    }
                    change={stabilityPercent - 50}
                    tone={stabilityPercent >= 70 ? "positive" : "negative"}
                    icon={<IconWallet className="h-5 w-5" />}
                  />
                </div>

                {/* --------------------------------------------------------- */}
                {/* 3. Emergency Fund Progress                               */}
                {/* --------------------------------------------------------- */}
                <Card className="border border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconShieldCheck className="h-5 w-5 text-primary" />
                      Emergency Fund Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          You have{" "}
                          <span className="font-semibold">
                            {metrics.emergencyFundMonths.toFixed(1)} months
                          </span>{" "}
                          of expenses covered
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: {metrics.emergencyFundTarget} months of
                          emergency reserves
                        </p>
                      </div>
                      <span
                        className={`text-2xl font-semibold ${
                          emergencyColor === "emerald"
                            ? "text-emerald-600"
                            : emergencyColor === "amber"
                              ? "text-amber-600"
                              : "text-rose-600"
                        }`}
                      >
                        {emergencyPercent.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={emergencyPercent}
                      className={`h-3 ${
                        emergencyColor === "emerald"
                          ? "[&>div]:bg-emerald-500"
                          : emergencyColor === "amber"
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-rose-500"
                      }`}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>0 months</span>
                      <span>3 months</span>
                      <span>{metrics.emergencyFundTarget} months</span>
                    </div>
                  </CardContent>
                </Card>

                {/* --------------------------------------------------------- */}
                {/* 4. Expense Velocity + 5. Income Profile                   */}
                {/* --------------------------------------------------------- */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Expense Velocity */}
                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle>Expense Velocity</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        How your spending is changing over time
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Current Avg
                          </p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(
                              metrics.expenseVelocity.currentMonthlyAvg
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-center">
                          {metrics.expenseVelocity.trend === "increasing" ? (
                            <IconArrowUpRight className="h-6 w-6 text-rose-500" />
                          ) : metrics.expenseVelocity.trend === "decreasing" ? (
                            <IconArrowDownRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <IconMinus className="h-6 w-6 text-muted-foreground" />
                          )}
                          <span
                            className={`text-sm font-semibold ${
                              metrics.expenseVelocity.trend === "increasing"
                                ? "text-rose-600"
                                : metrics.expenseVelocity.trend === "decreasing"
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {metrics.expenseVelocity.changePercent >= 0
                              ? "+"
                              : ""}
                            {metrics.expenseVelocity.changePercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Previous Avg
                          </p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(
                              metrics.expenseVelocity.previousMonthlyAvg
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <Badge
                          variant="outline"
                          className={`${
                            metrics.expenseVelocity.trend === "increasing"
                              ? "bg-rose-500/10 text-rose-700 border-rose-200"
                              : metrics.expenseVelocity.trend === "decreasing"
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                : "bg-slate-500/10 text-slate-700 border-slate-200"
                          }`}
                        >
                          {metrics.expenseVelocity.trend === "increasing"
                            ? "Expenses Rising"
                            : metrics.expenseVelocity.trend === "decreasing"
                              ? "Expenses Falling"
                              : "Expenses Stable"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Income Profile */}
                  <Card className="border border-border/70">
                    <CardHeader>
                      <CardTitle>Income Profile</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Stability and characteristics of your income
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="rounded-xl border border-border/70 p-4">
                        <p className="text-xs text-muted-foreground">
                          Average Monthly Income
                        </p>
                        <p className="text-2xl font-semibold">
                          {formatCurrency(
                            metrics.incomeProfile.avgMonthlyIncome
                          )}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Income Stability
                          </span>
                          <span className="font-semibold">
                            {stabilityPercent}%
                          </span>
                        </div>
                        <Progress
                          value={stabilityPercent}
                          className={`h-2 ${
                            stabilityPercent >= 70
                              ? "[&>div]:bg-emerald-500"
                              : stabilityPercent >= 40
                                ? "[&>div]:bg-amber-500"
                                : "[&>div]:bg-rose-500"
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Income Type
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            metrics.incomeProfile.isVariable
                              ? "bg-amber-500/10 text-amber-700 border-amber-200"
                              : "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          }
                        >
                          {metrics.incomeProfile.isVariable
                            ? "Variable"
                            : "Stable"}
                        </Badge>
                      </div>
                      {metrics.incomeProfile.lastIncomeDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Last Income
                          </span>
                          <span className="text-sm font-medium">
                            {new Date(
                              metrics.incomeProfile.lastIncomeDate
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* --------------------------------------------------------- */}
                {/* 6. Net Worth Timeline Chart                              */}
                {/* --------------------------------------------------------- */}
                <Card className="border border-border/70">
                  <CardHeader>
                    <CardTitle>Net Worth Timeline</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Bank balance and investment value over time
                    </p>
                  </CardHeader>
                  <CardContent>
                    {metrics.netWorthTimeline.length > 0 ? (
                      <ChartContainer
                        config={netWorthConfig}
                        className="h-[350px] w-full"
                      >
                        <AreaChart data={metrics.netWorthTimeline}>
                          <defs>
                            <linearGradient
                              id="bankBalanceFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#0ea5e9"
                                stopOpacity={0.4}
                              />
                              <stop
                                offset="100%"
                                stopColor="#0ea5e9"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                            <linearGradient
                              id="investmentFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#22c55e"
                                stopOpacity={0.4}
                              />
                              <stop
                                offset="100%"
                                stopColor="#22c55e"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="hsl(var(--border))"
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{
                              fontSize: 12,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fontSize: 12,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            tickFormatter={formatCompactAxis}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                indicator="dot"
                                formatter={(value: number) =>
                                  formatCurrency(value)
                                }
                              />
                            }
                          />
                          <Area
                            dataKey="bankBalance"
                            type="monotone"
                            fill="url(#bankBalanceFill)"
                            stroke="#0ea5e9"
                            strokeWidth={3}
                            strokeOpacity={0.95}
                            stackId="networth"
                            isAnimationActive={false}
                          />
                          <Area
                            dataKey="investmentValue"
                            type="monotone"
                            fill="url(#investmentFill)"
                            stroke="#22c55e"
                            strokeWidth={3}
                            strokeOpacity={0.95}
                            stackId="networth"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                        No net worth data available yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
