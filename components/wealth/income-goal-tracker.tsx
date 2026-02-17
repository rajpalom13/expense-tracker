"use client"

import * as React from "react"
import { useState } from "react"
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
  IconCash,
  IconEdit,
  IconTarget,
  IconTrendingUp,
  IconTrash,
  IconPlus,
  IconArrowUpRight,
  IconArrowDownRight,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatINR, formatCompact, formatCompactAxis } from "@/lib/format"
import { stagger, fadeUp, fadeUpSmall, scaleIn, numberPop } from "@/lib/motion"
import {
  useIncomeGoal,
  useSetIncomeGoal,
  useDeleteIncomeGoal,
} from "@/hooks/use-income-goals"
import type { IncomeSource } from "@/hooks/use-income-goals"

// ─── Types ───

interface GoalFormData {
  targetAmount: string
  targetDate: string
  sources: { name: string; expected: string; frequency: string }[]
}

const EMPTY_FORM: GoalFormData = {
  targetAmount: "",
  targetDate: "",
  sources: [{ name: "", expected: "", frequency: "monthly" }],
}

const FREQUENCY_OPTIONS = ["monthly", "quarterly", "yearly", "one-time"]

// ─── Progress Ring ───

function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 8,
  className = "",
}: {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 100)

  // Color based on progress
  const ringColor =
    clamped >= 80
      ? "stroke-emerald-500"
      : clamped >= 50
        ? "stroke-amber-500"
        : "stroke-blue-500"

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <span className="text-2xl font-bold tabular-nums">{Math.round(clamped)}%</span>
        <span className="text-[10px] text-muted-foreground">complete</span>
      </div>
    </div>
  )
}

// ─── Custom Chart Tooltip ───

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatINR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Month Label Helper ───

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-")
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

// ─── Source Form Row ───

function SourceRow({
  source,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  source: { name: string; expected: string; frequency: string }
  index: number
  onChange: (index: number, field: string, value: string) => void
  onRemove: (index: number) => void
  canRemove: boolean
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        {index === 0 && <Label className="text-xs">Source Name</Label>}
        <Input
          placeholder="e.g. Salary"
          value={source.name}
          onChange={(e) => onChange(index, "name", e.target.value)}
        />
      </div>
      <div className="w-28 space-y-1">
        {index === 0 && <Label className="text-xs">Expected</Label>}
        <Input
          type="number"
          placeholder="Amount"
          value={source.expected}
          onChange={(e) => onChange(index, "expected", e.target.value)}
        />
      </div>
      <div className="w-28 space-y-1">
        {index === 0 && <Label className="text-xs">Frequency</Label>}
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={source.frequency}
          onChange={(e) => onChange(index, "frequency", e.target.value)}
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ───

export function IncomeGoalTracker() {
  const { data, isLoading, error } = useIncomeGoal()
  const setGoalMutation = useSetIncomeGoal()
  const deleteGoalMutation = useDeleteIncomeGoal()

  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formData, setFormData] = useState<GoalFormData>(EMPTY_FORM)

  const goal = data?.goal ?? null
  const progress = data?.progress ?? null

  // ─── Handlers ───

  const openSetGoalDialog = () => {
    if (goal) {
      setFormData({
        targetAmount: String(goal.targetAmount),
        targetDate: goal.targetDate.split("T")[0],
        sources:
          goal.sources.length > 0
            ? goal.sources.map((s) => ({
                name: s.name,
                expected: String(s.expected),
                frequency: s.frequency,
              }))
            : [{ name: "", expected: "", frequency: "monthly" }],
      })
    } else {
      setFormData(EMPTY_FORM)
    }
    setShowGoalDialog(true)
  }

  const handleSourceChange = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const sources = [...prev.sources]
      sources[index] = { ...sources[index], [field]: value }
      return { ...prev, sources }
    })
  }

  const addSource = () => {
    setFormData((prev) => ({
      ...prev,
      sources: [...prev.sources, { name: "", expected: "", frequency: "monthly" }],
    }))
  }

  const removeSource = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index),
    }))
  }

  const handleSaveGoal = async () => {
    if (!formData.targetAmount || !formData.targetDate) return

    const sources: IncomeSource[] = formData.sources
      .filter((s) => s.name.trim() && s.expected)
      .map((s) => ({
        name: s.name.trim(),
        expected: Number(s.expected),
        frequency: s.frequency,
      }))

    try {
      await setGoalMutation.mutateAsync({
        targetAmount: Number(formData.targetAmount),
        targetDate: formData.targetDate,
        sources,
      })
      setShowGoalDialog(false)
      toast.success(goal ? "Income goal updated" : "Income goal created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save income goal")
    }
  }

  const handleDeleteGoal = async () => {
    try {
      await deleteGoalMutation.mutateAsync()
      setShowDeleteDialog(false)
      toast.success("Income goal deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete income goal")
    }
  }

  // ─── Loading State ───

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTarget className="h-5 w-5 text-primary" />
            Income Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    )
  }

  // ─── Error State ───

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTarget className="h-5 w-5 text-primary" />
            Income Goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load income goal data. Please try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ─── No Goal State (compact banner) ───

  if (!goal) {
    return (
      <>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-card/50 px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <IconCash className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              Track your fiscal year income progress
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 ml-3 h-8"
            onClick={openSetGoalDialog}
          >
            <IconPlus className="h-3.5 w-3.5" />
            Set Goal
          </Button>
        </motion.div>

        {/* Goal Dialog */}
        <GoalDialog
          open={showGoalDialog}
          onOpenChange={setShowGoalDialog}
          formData={formData}
          isEditing={false}
          isSaving={setGoalMutation.isPending}
          onSave={handleSaveGoal}
          onSourceChange={handleSourceChange}
          onAddSource={addSource}
          onRemoveSource={removeSource}
          setFormData={setFormData}
        />
      </>
    )
  }

  // ─── Build chart data from monthly breakdown ───

  const chartData = (progress?.monthlyBreakdown ?? []).map((entry) => {
    const row: Record<string, string | number> = {
      month: formatMonthLabel(entry.month),
    }
    for (const [source, amount] of Object.entries(entry.sources)) {
      row[source] = amount
    }
    row._total = entry.total
    return row
  })

  const allSources = progress?.incomeSources ?? []

  // Chart colors using CSS variables
  const SOURCE_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]

  // ─── Render with Goal ───

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTarget className="h-5 w-5 text-primary" />
            Income Goal
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openSetGoalDialog}>
                <IconEdit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Overview */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col sm:flex-row items-center gap-6"
          >
            {/* Progress Ring */}
            <motion.div variants={scaleIn}>
              <ProgressRing percent={goal.percentComplete} />
            </motion.div>

            {/* Stats */}
            <div className="flex-1 space-y-3">
              <motion.div variants={numberPop}>
                <p className="text-sm text-muted-foreground">Earned this fiscal year</p>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {formatINR(progress?.totalIncome ?? 0)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {formatINR(goal.targetAmount)}
                  </span>
                </p>
              </motion.div>

              <motion.div variants={fadeUpSmall} className="flex flex-wrap gap-2">
                {/* On track badge */}
                {goal.onTrack ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  >
                    <IconCheck className="h-3 w-3" />
                    On Track
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  >
                    <IconAlertTriangle className="h-3 w-3" />
                    Behind Target
                  </Badge>
                )}

                {/* MoM growth badge */}
                {progress?.monthOverMonthGrowth !== null &&
                  progress?.monthOverMonthGrowth !== undefined && (
                    <Badge
                      variant="outline"
                      className={`gap-1 ${
                        progress.monthOverMonthGrowth >= 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {progress.monthOverMonthGrowth >= 0 ? (
                        <IconArrowUpRight className="h-3 w-3" />
                      ) : (
                        <IconArrowDownRight className="h-3 w-3" />
                      )}
                      {progress.monthOverMonthGrowth >= 0 ? "+" : ""}
                      {progress.monthOverMonthGrowth.toFixed(1)}% MoM
                    </Badge>
                  )}
              </motion.div>

              {/* Gap analysis */}
              <motion.div variants={fadeUpSmall}>
                {goal.remaining > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Need{" "}
                    <span className="font-semibold text-foreground">
                      {formatCompact(goal.monthlyRequired)}
                    </span>
                    /month to hit target by{" "}
                    <span className="font-medium text-foreground">
                      {new Date(goal.targetDate).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {goal.monthsRemaining > 0 && (
                      <span> ({goal.monthsRemaining} months left)</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Target reached! You have exceeded your income goal.
                  </p>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Monthly Income Breakdown Chart */}
          {chartData.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Monthly Income Breakdown
              </p>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompactAxis}
                      width={50}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    {allSources.map((source, i) => (
                      <Bar
                        key={source}
                        dataKey={source}
                        name={source}
                        stackId="income"
                        fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                        radius={
                          i === allSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Source Expectations vs Actual */}
          {goal.sources.length > 0 && progress && (
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Income Sources
              </p>
              <div className="space-y-2">
                {goal.sources.map((source) => {
                  // Sum actual income from this source across all months
                  const actual = progress.monthlyBreakdown.reduce(
                    (sum, m) => sum + (m.sources[source.name] || 0),
                    0
                  )
                  // Expected total depends on frequency and months elapsed
                  const monthsElapsed = Math.max(progress.monthsWithData, 1)
                  const expectedTotal =
                    source.frequency === "monthly"
                      ? source.expected * monthsElapsed
                      : source.frequency === "quarterly"
                        ? source.expected * Math.ceil(monthsElapsed / 3)
                        : source.frequency === "yearly"
                          ? source.expected
                          : source.expected
                  const pct =
                    expectedTotal > 0 ? Math.min((actual / expectedTotal) * 100, 100) : 0

                  return (
                    <div key={source.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{source.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatCompact(actual)} / {formatCompact(expectedTotal)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            delay: 0.3,
                            duration: 0.5,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Goal Dialog */}
      <GoalDialog
        open={showGoalDialog}
        onOpenChange={setShowGoalDialog}
        formData={formData}
        isEditing={true}
        isSaving={setGoalMutation.isPending}
        onSave={handleSaveGoal}
        onSourceChange={handleSourceChange}
        onAddSource={addSource}
        onRemoveSource={removeSource}
        setFormData={setFormData}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Income Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your income goal? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGoal}
              disabled={deleteGoalMutation.isPending}
            >
              {deleteGoalMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Goal Dialog (shared between create and edit) ───

function GoalDialog({
  open,
  onOpenChange,
  formData,
  isEditing,
  isSaving,
  onSave,
  onSourceChange,
  onAddSource,
  onRemoveSource,
  setFormData,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: GoalFormData
  isEditing: boolean
  isSaving: boolean
  onSave: () => void
  onSourceChange: (index: number, field: string, value: string) => void
  onAddSource: () => void
  onRemoveSource: (index: number) => void
  setFormData: React.Dispatch<React.SetStateAction<GoalFormData>>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Income Goal" : "Set Income Goal"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your annual income target and expected sources."
              : "Set a target income for this fiscal year (April - March)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="targetAmount">Annual Target Amount</Label>
            <Input
              id="targetAmount"
              type="number"
              placeholder="e.g. 1200000"
              value={formData.targetAmount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, targetAmount: e.target.value }))
              }
            />
          </div>

          {/* Target Date */}
          <div className="space-y-1.5">
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={formData.targetDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, targetDate: e.target.value }))
              }
            />
          </div>

          {/* Income Sources */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Expected Income Sources</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={onAddSource}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Add Source
              </Button>
            </div>
            <div className="space-y-2">
              {formData.sources.map((source, i) => (
                <SourceRow
                  key={i}
                  source={source}
                  index={i}
                  onChange={onSourceChange}
                  onRemove={onRemoveSource}
                  canRemove={formData.sources.length > 1}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || !formData.targetAmount || !formData.targetDate}
          >
            {isSaving ? "Saving..." : isEditing ? "Update Goal" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
