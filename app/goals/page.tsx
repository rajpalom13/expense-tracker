"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
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
import {
  IconCash,
  IconChartLine,
  IconEdit,
  IconFlame,
  IconPigMoney,
  IconPlus,
  IconTarget,
  IconTrash,
} from "@tabler/icons-react"

import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MetricTile } from "@/components/metric-tile"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ───

interface SavingsGoal {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  monthlyContribution: number
  autoTrack: boolean
  category?: string
  createdAt: string
  updatedAt: string
  percentageComplete: number
  onTrack: boolean
  requiredMonthly: number
  projectedCompletionDate: string | null
  monthsRemaining: number
}

interface SipProjection {
  name: string
  current: number
  projected3y: number
  projected5y: number
  projected10y: number
}

interface EmergencyFundProgress {
  currentMonths: number
  targetMonths: number
  monthsToTarget: number
}

interface NetWorthProjectionPoint {
  year: number
  invested: number
  projected: number
}

interface FireData {
  fireNumber: number
  annualExpenses: number
  currentNetWorth: number
  progressPercent: number
  yearsToFIRE: number
  monthlyRequired: number
  projectionData: { year: number; netWorth: number; fireTarget: number }[]
}

interface PortfolioProjectionPoint {
  year: number
  stocks: number
  mutualFunds: number
  sips: number
  total: number
}

interface Projections {
  sipProjections: SipProjection[]
  emergencyFundProgress: EmergencyFundProgress
  netWorthProjection: NetWorthProjectionPoint[]
  fire: FireData
  portfolioProjection: PortfolioProjectionPoint[]
}

interface GoalFormData {
  name: string
  targetAmount: string
  targetDate: string
  monthlyContribution: string
  currentAmount: string
  category: string
}

// ─── Helpers ───

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompact(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value.toFixed(0)}`
}

function formatCompactAxis(value: number): string {
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(0)}L`
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value.toFixed(0)}`
}

const GOAL_CATEGORIES = [
  "Emergency Fund",
  "Car",
  "Vacation",
  "House",
  "Education",
  "Wedding",
  "Other",
]

const EMPTY_FORM: GoalFormData = {
  name: "",
  targetAmount: "",
  targetDate: "",
  monthlyContribution: "",
  currentAmount: "",
  category: "",
}

// ─── Component ───

export default function GoalsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  // Data state
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [projections, setProjections] = useState<Projections | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showContributionDialog, setShowContributionDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [formData, setFormData] = useState<GoalFormData>(EMPTY_FORM)
  const [contributionAmount, setContributionAmount] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // ─── Data Loading ───

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/savings-goals")
      const data = await res.json()
      if (data.success) setGoals(data.goals)
    } catch (err) {
      console.error("Failed to load goals:", err)
    }
  }, [])

  const loadProjections = useCallback(async () => {
    try {
      const res = await fetch("/api/projections")
      const data = await res.json()
      if (data.success) setProjections(data.projections)
    } catch (err) {
      console.error("Failed to load projections:", err)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    Promise.all([loadGoals(), loadProjections()]).finally(() =>
      setLoading(false)
    )
  }, [isAuthenticated, loadGoals, loadProjections])

  // ─── CRUD Operations ───

  const createGoal = async () => {
    if (!formData.name || !formData.targetAmount || !formData.targetDate) return
    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        targetAmount: Number(formData.targetAmount),
        targetDate: formData.targetDate,
      }
      if (formData.monthlyContribution)
        payload.monthlyContribution = Number(formData.monthlyContribution)
      if (formData.currentAmount)
        payload.currentAmount = Number(formData.currentAmount)
      if (formData.category) payload.category = formData.category

      const res = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        await loadGoals()
        setShowAddDialog(false)
        setFormData(EMPTY_FORM)
      }
    } catch (err) {
      console.error("Failed to create goal:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const updateGoal = async () => {
    if (!selectedGoal || !formData.name || !formData.targetAmount || !formData.targetDate) return
    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        id: selectedGoal.id,
        name: formData.name,
        targetAmount: Number(formData.targetAmount),
        targetDate: formData.targetDate,
      }
      if (formData.monthlyContribution)
        payload.monthlyContribution = Number(formData.monthlyContribution)
      if (formData.currentAmount)
        payload.currentAmount = Number(formData.currentAmount)
      if (formData.category) payload.category = formData.category

      const res = await fetch("/api/savings-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        await loadGoals()
        setShowEditDialog(false)
        setSelectedGoal(null)
        setFormData(EMPTY_FORM)
      }
    } catch (err) {
      console.error("Failed to update goal:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteGoal = async () => {
    if (!selectedGoal) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/savings-goals?id=${selectedGoal.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        await loadGoals()
        setShowDeleteDialog(false)
        setSelectedGoal(null)
      }
    } catch (err) {
      console.error("Failed to delete goal:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const addContribution = async () => {
    if (!selectedGoal || !contributionAmount) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/savings-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedGoal.id,
          addAmount: Number(contributionAmount),
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadGoals()
        setShowContributionDialog(false)
        setSelectedGoal(null)
        setContributionAmount("")
      }
    } catch (err) {
      console.error("Failed to add contribution:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Dialog Helpers ───

  const openEditDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    setFormData({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate.split("T")[0],
      monthlyContribution: String(goal.monthlyContribution),
      currentAmount: String(goal.currentAmount),
      category: goal.category || "",
    })
    setShowEditDialog(true)
  }

  const openContributionDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    setContributionAmount("")
    setShowContributionDialog(true)
  }

  const openDeleteDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    setShowDeleteDialog(true)
  }

  const openAddDialog = () => {
    setFormData(EMPTY_FORM)
    setShowAddDialog(true)
  }

  // ─── Derived Values ───

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0)
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const onTrackCount = goals.filter((g) => g.onTrack).length
  const overallProgress =
    totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

  // ─── Auth guards ───

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

  // ─── Render ───

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
          title="Goals & Projections"
          subtitle="Track savings goals and visualize your financial future"
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            {loading ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <Skeleton className="h-96" />
              </div>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label="Total Saved"
                    value={formatCurrency(totalSaved)}
                    trendLabel={`${goals.length} active goal${goals.length !== 1 ? "s" : ""}`}
                    icon={<IconPigMoney className="h-5 w-5" />}
                    tone="positive"
                  />
                  <MetricTile
                    label="Total Target"
                    value={formatCurrency(totalTarget)}
                    trendLabel={`${overallProgress.toFixed(1)}% overall`}
                    icon={<IconTarget className="h-5 w-5" />}
                    tone="neutral"
                  />
                  <MetricTile
                    label="On Track"
                    value={`${onTrackCount} / ${goals.length}`}
                    trendLabel={
                      goals.length > 0
                        ? `${((onTrackCount / goals.length) * 100).toFixed(0)}% on track`
                        : "No goals yet"
                    }
                    icon={<IconChartLine className="h-5 w-5" />}
                    tone={
                      goals.length > 0 && onTrackCount >= goals.length / 2
                        ? "positive"
                        : "negative"
                    }
                  />
                  <MetricTile
                    label="FIRE Progress"
                    value={
                      projections?.fire
                        ? `${projections.fire.progressPercent.toFixed(1)}%`
                        : "N/A"
                    }
                    trendLabel={
                      projections?.fire
                        ? `${projections.fire.yearsToFIRE.toFixed(1)} years to FIRE`
                        : "No projection data"
                    }
                    icon={<IconFlame className="h-5 w-5" />}
                    tone={
                      projections?.fire && projections.fire.progressPercent >= 25
                        ? "positive"
                        : "neutral"
                    }
                  />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="goals" className="space-y-4">
                  <TabsList className="flex flex-wrap gap-2">
                    <TabsTrigger value="goals">Savings Goals</TabsTrigger>
                    <TabsTrigger value="fire">FIRE Calculator</TabsTrigger>
                    <TabsTrigger value="investments">
                      Investment Projections
                    </TabsTrigger>
                    <TabsTrigger value="networth">
                      Net Worth Projection
                    </TabsTrigger>
                  </TabsList>

                  {/* ─── Tab 1: Savings Goals ─── */}
                  <TabsContent value="goals" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Savings Goals
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Track progress toward your financial milestones
                        </p>
                      </div>
                      <Button onClick={openAddDialog} size="sm">
                        <IconPlus className="mr-1 h-4 w-4" />
                        Add Goal
                      </Button>
                    </div>

                    {goals.length === 0 ? (
                      <Card className="border border-border/70">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                          <IconTarget className="mb-4 h-12 w-12 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            No savings goals yet
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Create your first goal to start tracking progress
                          </p>
                          <Button
                            onClick={openAddDialog}
                            size="sm"
                            className="mt-4"
                          >
                            <IconPlus className="mr-1 h-4 w-4" />
                            Create Goal
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {goals.map((goal) => (
                          <Card
                            key={goal.id}
                            className="border border-border/70"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">
                                    {goal.name}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    {goal.category && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {goal.category}
                                      </Badge>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className={
                                        goal.onTrack
                                          ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                                          : "border-rose-200 bg-rose-500/10 text-rose-700"
                                      }
                                    >
                                      {goal.onTrack ? "On Track" : "Behind"}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEditDialog(goal)}
                                  >
                                    <IconEdit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(goal)}
                                  >
                                    <IconTrash className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Progress */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Progress
                                  </span>
                                  <span className="font-semibold">
                                    {goal.percentageComplete.toFixed(1)}%
                                  </span>
                                </div>
                                <Progress
                                  value={Math.min(goal.percentageComplete, 100)}
                                  className="h-2"
                                />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>
                                    {formatCurrency(goal.currentAmount)}
                                  </span>
                                  <span>
                                    {formatCurrency(goal.targetAmount)}
                                  </span>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Target Date
                                  </p>
                                  <p className="font-medium">
                                    {new Date(
                                      goal.targetDate
                                    ).toLocaleDateString("en-IN", {
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Months Left
                                  </p>
                                  <p className="font-medium">
                                    {goal.monthsRemaining > 0
                                      ? `${goal.monthsRemaining} months`
                                      : "Overdue"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Required Monthly
                                  </p>
                                  <p className="font-medium">
                                    {formatCurrency(goal.requiredMonthly)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Projected Completion
                                  </p>
                                  <p className="font-medium">
                                    {goal.projectedCompletionDate
                                      ? new Date(
                                          goal.projectedCompletionDate
                                        ).toLocaleDateString("en-IN", {
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* Add Contribution */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  openContributionDialog(goal)
                                }
                              >
                                <IconCash className="mr-1 h-4 w-4" />
                                Add Contribution
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ─── Tab 2: FIRE Calculator ─── */}
                  <TabsContent value="fire" className="space-y-4">
                    {projections?.fire ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <MetricTile
                            label="FIRE Number"
                            value={formatCurrency(projections.fire.fireNumber)}
                            trendLabel={`25x annual expenses`}
                            icon={<IconFlame className="h-5 w-5" />}
                            tone="neutral"
                          />
                          <MetricTile
                            label="Current Progress"
                            value={`${projections.fire.progressPercent.toFixed(1)}%`}
                            trendLabel={formatCurrency(projections.fire.currentNetWorth)}
                            icon={<IconTarget className="h-5 w-5" />}
                            tone={
                              projections.fire.progressPercent >= 50
                                ? "positive"
                                : "neutral"
                            }
                          />
                          <MetricTile
                            label="Years to FIRE"
                            value={
                              projections.fire.yearsToFIRE < 100
                                ? `${projections.fire.yearsToFIRE.toFixed(1)} years`
                                : "100+ years"
                            }
                            trendLabel="At current rate"
                            icon={<IconChartLine className="h-5 w-5" />}
                            tone={
                              projections.fire.yearsToFIRE <= 15
                                ? "positive"
                                : "negative"
                            }
                          />
                          <MetricTile
                            label="Monthly Required"
                            value={formatCurrency(
                              projections.fire.monthlyRequired
                            )}
                            trendLabel="To stay on track"
                            icon={<IconCash className="h-5 w-5" />}
                            tone="neutral"
                          />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                          <Card className="border border-border/70 lg:col-span-2">
                            <CardHeader>
                              <CardTitle>FIRE Projection</CardTitle>
                              <CardDescription>
                                Projected net worth vs FIRE target over time
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {projections.fire.projectionData.length > 0 ? (
                                <ResponsiveContainer
                                  width="100%"
                                  height={320}
                                >
                                  <LineChart
                                    data={projections.fire.projectionData}
                                  >
                                    <CartesianGrid
                                      vertical={false}
                                      stroke="hsl(var(--border))"
                                    />
                                    <XAxis
                                      dataKey="year"
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
                                    <Tooltip
                                      formatter={(value: number) =>
                                        formatCurrency(value)
                                      }
                                      contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 12,
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="netWorth"
                                      name="Net Worth"
                                      stroke="#22c55e"
                                      strokeWidth={3}
                                      strokeOpacity={0.95}
                                      isAnimationActive={false}
                                      dot={false}
                                      activeDot={{ r: 5, fill: "#22c55e" }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="fireTarget"
                                      name="FIRE Target"
                                      stroke="#f43f5e"
                                      strokeWidth={2}
                                      strokeDasharray="8 4"
                                      strokeOpacity={0.8}
                                      isAnimationActive={false}
                                      dot={false}
                                      activeDot={{ r: 5, fill: "#f43f5e" }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                                  No FIRE projection data available.
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="border border-border/70">
                            <CardHeader>
                              <CardTitle>FIRE Breakdown</CardTitle>
                              <CardDescription>
                                Key financial independence metrics
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="rounded-xl border border-border/70 p-4">
                                <p className="text-xs text-muted-foreground">
                                  Annual Expenses
                                </p>
                                <p className="text-xl font-semibold">
                                  {formatCurrency(
                                    projections.fire.annualExpenses
                                  )}
                                </p>
                              </div>
                              <div className="rounded-xl border border-border/70 p-4">
                                <p className="text-xs text-muted-foreground">
                                  Current Net Worth
                                </p>
                                <p className="text-xl font-semibold">
                                  {formatCurrency(
                                    projections.fire.currentNetWorth
                                  )}
                                </p>
                              </div>
                              <div className="rounded-xl border border-border/70 p-4">
                                <p className="text-xs text-muted-foreground">
                                  Remaining to FIRE
                                </p>
                                <p className="text-xl font-semibold">
                                  {formatCurrency(
                                    projections.fire.fireNumber -
                                      projections.fire.currentNetWorth
                                  )}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    FIRE Progress
                                  </span>
                                  <span className="font-semibold">
                                    {projections.fire.progressPercent.toFixed(1)}
                                    %
                                  </span>
                                </div>
                                <Progress
                                  value={Math.min(
                                    projections.fire.progressPercent,
                                    100
                                  )}
                                  className="h-2.5"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    ) : (
                      <Card className="border border-border/70">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                          <IconFlame className="mb-4 h-12 w-12 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            No FIRE projection data available
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add investments and expense data to generate FIRE
                            projections
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* ─── Tab 3: Investment Projections ─── */}
                  <TabsContent value="investments" className="space-y-4">
                    {projections ? (
                      <>
                        {/* SIP Projections Table */}
                        {projections.sipProjections.length > 0 && (
                          <Card className="border border-border/70">
                            <CardHeader>
                              <CardTitle>SIP Projections</CardTitle>
                              <CardDescription>
                                Projected growth of your SIP investments
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">
                                      Current Value
                                    </TableHead>
                                    <TableHead className="text-right">
                                      3Y Projection
                                    </TableHead>
                                    <TableHead className="text-right">
                                      5Y Projection
                                    </TableHead>
                                    <TableHead className="text-right">
                                      10Y Projection
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {projections.sipProjections.map((sip) => (
                                    <TableRow key={sip.name}>
                                      <TableCell className="font-medium">
                                        {sip.name.length > 40
                                          ? `${sip.name.substring(0, 40)}...`
                                          : sip.name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(sip.current)}
                                      </TableCell>
                                      <TableCell className="text-right text-emerald-600">
                                        {formatCurrency(sip.projected3y)}
                                      </TableCell>
                                      <TableCell className="text-right text-emerald-600">
                                        {formatCurrency(sip.projected5y)}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-emerald-600">
                                        {formatCurrency(sip.projected10y)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        )}

                        {/* Portfolio Projection Chart */}
                        {projections.portfolioProjection.length > 0 && (
                          <Card className="border border-border/70">
                            <CardHeader>
                              <CardTitle>Portfolio Projection</CardTitle>
                              <CardDescription>
                                Projected growth by asset class over time
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={350}>
                                <AreaChart
                                  data={projections.portfolioProjection}
                                >
                                  <defs>
                                    <linearGradient
                                      id="stocksFill"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#6366f1"
                                        stopOpacity={0.4}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#6366f1"
                                        stopOpacity={0.05}
                                      />
                                    </linearGradient>
                                    <linearGradient
                                      id="mfFill"
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
                                      id="sipsFill"
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
                                    dataKey="year"
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
                                  <Tooltip
                                    formatter={(value: number) =>
                                      formatCurrency(value)
                                    }
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border:
                                        "1px solid hsl(var(--border))",
                                      borderRadius: 12,
                                    }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="stocks"
                                    name="Stocks"
                                    stackId="1"
                                    stroke="#6366f1"
                                    fill="url(#stocksFill)"
                                    strokeWidth={2}
                                    strokeOpacity={0.95}
                                    isAnimationActive={false}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="mutualFunds"
                                    name="Mutual Funds"
                                    stackId="1"
                                    stroke="#0ea5e9"
                                    fill="url(#mfFill)"
                                    strokeWidth={2}
                                    strokeOpacity={0.95}
                                    isAnimationActive={false}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="sips"
                                    name="SIPs"
                                    stackId="1"
                                    stroke="#22c55e"
                                    fill="url(#sipsFill)"
                                    strokeWidth={2}
                                    strokeOpacity={0.95}
                                    isAnimationActive={false}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {projections.sipProjections.length === 0 &&
                          projections.portfolioProjection.length === 0 && (
                            <Card className="border border-border/70">
                              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <IconChartLine className="mb-4 h-12 w-12 text-muted-foreground/40" />
                                <p className="text-sm font-medium text-muted-foreground">
                                  No investment projection data available
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Add stocks, mutual funds, or SIPs to see
                                  projections
                                </p>
                              </CardContent>
                            </Card>
                          )}
                      </>
                    ) : (
                      <Card className="border border-border/70">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                          <IconChartLine className="mb-4 h-12 w-12 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            Loading projection data...
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* ─── Tab 4: Net Worth Projection ─── */}
                  <TabsContent value="networth" className="space-y-4">
                    {projections ? (
                      <>
                        <div className="grid gap-4 lg:grid-cols-3">
                          {/* Net Worth Chart */}
                          <Card className="border border-border/70 lg:col-span-2">
                            <CardHeader>
                              <CardTitle>Net Worth Trajectory</CardTitle>
                              <CardDescription>
                                Invested amount vs projected growth over time
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {projections.netWorthProjection.length > 0 ? (
                                <ResponsiveContainer
                                  width="100%"
                                  height={350}
                                >
                                  <AreaChart
                                    data={projections.netWorthProjection}
                                  >
                                    <defs>
                                      <linearGradient
                                        id="investedFill"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                      >
                                        <stop
                                          offset="0%"
                                          stopColor="#94a3b8"
                                          stopOpacity={0.3}
                                        />
                                        <stop
                                          offset="100%"
                                          stopColor="#94a3b8"
                                          stopOpacity={0.05}
                                        />
                                      </linearGradient>
                                      <linearGradient
                                        id="projectedFill"
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
                                      dataKey="year"
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
                                    <Tooltip
                                      formatter={(value: number) =>
                                        formatCurrency(value)
                                      }
                                      contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border:
                                          "1px solid hsl(var(--border))",
                                        borderRadius: 12,
                                      }}
                                    />
                                    <Area
                                      type="monotone"
                                      dataKey="invested"
                                      name="Invested"
                                      stroke="#94a3b8"
                                      fill="url(#investedFill)"
                                      strokeWidth={2}
                                      strokeOpacity={0.8}
                                      isAnimationActive={false}
                                    />
                                    <Area
                                      type="monotone"
                                      dataKey="projected"
                                      name="Projected"
                                      stroke="#22c55e"
                                      fill="url(#projectedFill)"
                                      strokeWidth={3}
                                      strokeOpacity={0.95}
                                      isAnimationActive={false}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                                  No net worth projection data available.
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Emergency Fund Progress */}
                          <Card className="border border-border/70">
                            <CardHeader>
                              <CardTitle>Emergency Fund</CardTitle>
                              <CardDescription>
                                Progress toward your safety net
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {projections.emergencyFundProgress ? (
                                <>
                                  <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative flex h-32 w-32 items-center justify-center">
                                      <svg
                                        className="h-32 w-32 -rotate-90"
                                        viewBox="0 0 120 120"
                                      >
                                        <circle
                                          cx="60"
                                          cy="60"
                                          r="52"
                                          fill="none"
                                          stroke="hsl(var(--border))"
                                          strokeWidth="8"
                                        />
                                        <circle
                                          cx="60"
                                          cy="60"
                                          r="52"
                                          fill="none"
                                          stroke={
                                            projections.emergencyFundProgress
                                              .currentMonths >=
                                            projections.emergencyFundProgress
                                              .targetMonths
                                              ? "#22c55e"
                                              : "#f59e0b"
                                          }
                                          strokeWidth="8"
                                          strokeLinecap="round"
                                          strokeDasharray={`${
                                            Math.min(
                                              (projections
                                                .emergencyFundProgress
                                                .currentMonths /
                                                projections
                                                  .emergencyFundProgress
                                                  .targetMonths) *
                                                326.73,
                                              326.73
                                            )
                                          } 326.73`}
                                        />
                                      </svg>
                                      <div className="absolute flex flex-col items-center">
                                        <span className="text-2xl font-bold">
                                          {projections.emergencyFundProgress.currentMonths.toFixed(
                                            1
                                          )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          months
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">
                                        Target
                                      </span>
                                      <span className="font-medium">
                                        {
                                          projections.emergencyFundProgress
                                            .targetMonths
                                        }{" "}
                                        months
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">
                                        Current
                                      </span>
                                      <span className="font-medium">
                                        {projections.emergencyFundProgress.currentMonths.toFixed(
                                          1
                                        )}{" "}
                                        months
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">
                                        Remaining
                                      </span>
                                      <span className="font-medium">
                                        {projections.emergencyFundProgress
                                          .monthsToTarget > 0
                                          ? `${projections.emergencyFundProgress.monthsToTarget} months to build`
                                          : "Target reached"}
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                  No emergency fund data available.
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    ) : (
                      <Card className="border border-border/70">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                          <IconPigMoney className="mb-4 h-12 w-12 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-muted-foreground">
                            Loading net worth data...
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ─── Add Goal Dialog ─── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Savings Goal</DialogTitle>
            <DialogDescription>
              Create a new savings goal to track your progress
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="goal-name">Name</Label>
              <Input
                id="goal-name"
                placeholder="e.g. Emergency Fund, New Car"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="goal-target">Target Amount</Label>
                <Input
                  id="goal-target"
                  type="number"
                  placeholder="500000"
                  value={formData.targetAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      targetAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="goal-current">Current Amount</Label>
                <Input
                  id="goal-current"
                  type="number"
                  placeholder="0"
                  value={formData.currentAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      currentAmount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="goal-date">Target Date</Label>
                <Input
                  id="goal-date"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      targetDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="goal-monthly">Monthly Contribution</Label>
                <Input
                  id="goal-monthly"
                  type="number"
                  placeholder="10000"
                  value={formData.monthlyContribution}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      monthlyContribution: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="goal-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createGoal}
              disabled={
                isSaving ||
                !formData.name ||
                !formData.targetAmount ||
                !formData.targetDate
              }
            >
              {isSaving ? "Creating..." : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Goal Dialog ─── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>
              Update your savings goal details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-target">Target Amount</Label>
                <Input
                  id="edit-target"
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      targetAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-current">Current Amount</Label>
                <Input
                  id="edit-current"
                  type="number"
                  value={formData.currentAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      currentAmount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Target Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      targetDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-monthly">Monthly Contribution</Label>
                <Input
                  id="edit-monthly"
                  type="number"
                  value={formData.monthlyContribution}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      monthlyContribution: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={updateGoal}
              disabled={
                isSaving ||
                !formData.name ||
                !formData.targetAmount ||
                !formData.targetDate
              }
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Contribution Dialog ─── */}
      <Dialog
        open={showContributionDialog}
        onOpenChange={setShowContributionDialog}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>
              {selectedGoal
                ? `Add funds to "${selectedGoal.name}"`
                : "Add funds to your goal"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedGoal && (
              <div className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-medium">
                    {formatCurrency(selectedGoal.currentAmount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium">
                    {formatCurrency(
                      selectedGoal.targetAmount - selectedGoal.currentAmount
                    )}
                  </span>
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="contribution-amount">Amount</Label>
              <Input
                id="contribution-amount"
                type="number"
                placeholder="5000"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowContributionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={addContribution}
              disabled={isSaving || !contributionAmount}
            >
              {isSaving ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedGoal?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteGoal}
              disabled={isSaving}
            >
              {isSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
