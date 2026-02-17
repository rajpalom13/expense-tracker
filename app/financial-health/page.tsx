"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconHeartbeat,
  IconShieldCheck,
  IconTrendingDown,
  IconTrendingUp,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconCash,
  IconChartLine,
  IconWallet,
  IconTargetArrow,
  IconChartDonut,
  IconActivity,
  IconCalendarStats,
  IconCreditCard,
  IconPlus,
  IconPencil,
  IconTrash,
  IconBuildingBank,
  IconRobot,
  IconPigMoney,
  IconChartBar,
  IconChecklist,
  IconArrowRight,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { useFinancialHealth } from "@/hooks/use-financial-health"
import { AppSidebar } from "@/components/app-sidebar"
import { InfoTooltip } from "@/components/info-tooltip"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { formatINR as formatCurrency, formatCompact, formatCompactAxis } from "@/lib/format"
import {
  stagger,
  fadeUp,
  fadeUpSmall,
  scaleIn,
  numberPop,
  listItem,
} from "@/lib/motion"

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

interface Debt {
  id: string
  name: string
  type: string
  principal: number
  interestRate: number
  emiAmount: number
  tenure: number
  startDate: string
  paidEMIs: number
  remainingBalance: number
  status: "active" | "closed"
  notes?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBT_TYPES = [
  { value: "home_loan", label: "Home Loan" },
  { value: "car_loan", label: "Car Loan" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "education_loan", label: "Education Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
] as const

const DEBT_TYPE_LABELS: Record<string, string> = {
  home_loan: "Home Loan",
  car_loan: "Car Loan",
  personal_loan: "Personal Loan",
  education_loan: "Education Loan",
  credit_card: "Credit Card",
  other: "Other",
}

const EMPTY_DEBT_FORM = {
  name: "",
  type: "",
  principal: "",
  interestRate: "",
  emiAmount: "",
  tenure: "",
  startDate: "",
  paidEMIs: "0",
  remainingBalance: "",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600"
  if (score >= 50) return "text-amber-500"
  if (score >= 25) return "text-orange-500"
  return "text-rose-600"
}

function getScoreRingColor(score: number): string {
  if (score >= 75) return "#10b981"
  if (score >= 50) return "#f59e0b"
  if (score >= 25) return "#f97316"
  return "#f43f5e"
}

function getScoreGlowColor(score: number): string {
  if (score >= 75) return "rgba(16, 185, 129, 0.25)"
  if (score >= 50) return "rgba(245, 158, 11, 0.2)"
  if (score >= 25) return "rgba(249, 115, 22, 0.2)"
  return "rgba(244, 63, 94, 0.2)"
}

function getScoreBadgeBg(score: number): string {
  if (score >= 75) return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
  if (score >= 50) return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
  if (score >= 25) return "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
  return "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Excellent"
  if (score >= 50) return "Good"
  if (score >= 25) return "Needs Work"
  return "Critical"
}

function getBarGradient(pct: number): { from: string; to: string; className: string } {
  if (pct >= 75) return { from: "#34d399", to: "#10b981", className: "emerald" }
  if (pct >= 50) return { from: "#fbbf24", to: "#f59e0b", className: "amber" }
  if (pct >= 25) return { from: "#fb923c", to: "#f97316", className: "orange" }
  return { from: "#fb7185", to: "#f43f5e", className: "rose" }
}

function calculateNextDueDate(startDate: string, paidEMIs: number): Date {
  const start = new Date(startDate)
  const next = new Date(start)
  next.setMonth(next.getMonth() + paidEMIs + 1)
  return next
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

// ---------------------------------------------------------------------------
// Score Ring Component (Premium)
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(score, 100) / 100
  const strokeDashoffset = circumference * (1 - progress)
  const color = getScoreRingColor(score)
  const glowColor = getScoreGlowColor(score)
  const gradientId = "score-ring-gradient"
  const center = size / 2

  return (
    <motion.div
      variants={scaleIn}
      className="relative inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 16px ${glowColor})`,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeOpacity={0.4}
        />

        {/* Progress arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${center} ${center})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ delay: 0.3, duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          variants={numberPop}
          className={`text-4xl font-extrabold tracking-tight tabular-nums ${getScoreColor(score)}`}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide">
          of 100
        </span>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Stat Item for the top bar
// ---------------------------------------------------------------------------

function StatItem({
  icon: Icon,
  label,
  value,
  suffix,
  colorClass,
  index,
}: {
  icon: React.ElementType
  label: string
  value: string
  suffix?: string
  colorClass?: string
  index: number
}) {
  const anim = listItem(index)
  return (
    <motion.div
      initial={anim.initial}
      animate={anim.animate}
      transition={anim.transition}
      className="flex items-center gap-3 px-5 py-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5 truncate">
          {label}
        </p>
        <p className={`text-lg font-bold tabular-nums leading-tight ${colorClass || ""}`}>
          {value}
          {suffix && (
            <span className="text-sm font-normal text-muted-foreground"> {suffix}</span>
          )}
        </p>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Breakdown Bar (Enhanced with gradients and hover)
// ---------------------------------------------------------------------------

function BreakdownBar({
  label,
  score,
  maxScore,
  tooltip,
  index,
  icon: Icon,
}: {
  label: string
  score: number
  maxScore: number
  tooltip?: string
  index: number
  icon: React.ElementType
}) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0
  const gradientId = `bar-gradient-${index}`
  const gradient = getBarGradient(percentage)
  const anim = listItem(index)

  return (
    <motion.div
      initial={anim.initial}
      animate={anim.animate}
      transition={anim.transition}
      className="group rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-2 font-medium text-foreground/90">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
          {tooltip && <InfoTooltip text={tooltip} iconClassName="h-3 w-3" />}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tabular-nums">
            {score.toFixed(1)}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums w-9 text-right">
            / {maxScore}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
        <svg width="100%" height="100%" className="rounded-full">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradient.from} stopOpacity={0.8} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
          <motion.rect
            x={0}
            y={0}
            height="100%"
            rx={4}
            ry={4}
            fill={`url(#${gradientId})`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(percentage, 1)}%` }}
            transition={{ delay: 0.15 + index * 0.06, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </svg>
      </div>
      <div className="mt-1 overflow-hidden">
        <p className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {percentage >= 75
            ? "Strong performance in this area"
            : percentage >= 50
              ? "Room for improvement"
              : percentage >= 25
                ? "Needs attention"
                : "Critical area to address"}
        </p>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Net Worth Chart
// ---------------------------------------------------------------------------

function NetWorthTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload) return null
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2.5 text-sm py-0.5">
          <div
            className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-card"
            style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}40` }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === "bankBalance" ? "Bank" : "Investments"}
          </span>
          <span className="font-bold tabular-nums ml-auto">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Asset Allocation Pie Chart Tooltip
// ---------------------------------------------------------------------------

function AssetPieTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string } }>
}) {
  if (!active || !payload || !payload[0]) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="text-muted-foreground">{entry.name}</span>
        <span className="font-bold tabular-nums ml-auto">{formatCurrency(entry.value)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Net Worth Hero Section
// ---------------------------------------------------------------------------

function NetWorthHero({
  metrics,
  totalDebts,
}: {
  metrics: FinancialHealthMetrics
  totalDebts: number
}) {
  const latestPoint = metrics.netWorthTimeline.at(-1)
  const prevPoint = metrics.netWorthTimeline.at(-2)

  const bankBalance = latestPoint?.bankBalance || 0
  const investmentValue = latestPoint?.investmentValue || 0
  const totalNetWorth = bankBalance + investmentValue - totalDebts

  const prevNetWorth = prevPoint
    ? (prevPoint.bankBalance + prevPoint.investmentValue - totalDebts)
    : 0
  const netWorthChange = prevPoint ? totalNetWorth - prevNetWorth : 0
  const netWorthChangePct = prevNetWorth > 0 ? (netWorthChange / prevNetWorth) * 100 : 0

  const isPositiveChange = netWorthChange >= 0

  // Asset allocation data (filter out zero values)
  const assetData = [
    { name: "Bank", value: bankBalance, color: "var(--chart-4)" },
    { name: "Investments", value: investmentValue, color: "var(--chart-1)" },
  ].filter((d) => d.value > 0)

  // If debts exist, show them as a separate slice for context
  if (totalDebts > 0) {
    assetData.push({ name: "Debts", value: totalDebts, color: "var(--chart-5)" })
  }

  const totalAssets = bankBalance + investmentValue

  return (
    <motion.div variants={fadeUp}>
      <div className="card-elevated rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
            <IconBuildingBank className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Net Worth</h3>
          <InfoTooltip text="Total net worth = Bank Balance + Investment Value - Outstanding Debts. Asset allocation shows the breakdown of your holdings." />
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          {/* Left: Net worth number + breakdown */}
          <div className="space-y-4">
            {/* Main number */}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Total Net Worth
              </p>
              <motion.p
                variants={numberPop}
                className="text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight"
              >
                {formatCurrency(totalNetWorth)}
              </motion.p>
              {prevPoint && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                      isPositiveChange
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {isPositiveChange ? (
                      <IconArrowUpRight className="h-3 w-3" />
                    ) : (
                      <IconArrowDownRight className="h-3 w-3" />
                    )}
                    {isPositiveChange ? "+" : ""}
                    {formatCompact(netWorthChange)}
                  </span>
                  <span className={`text-xs font-medium tabular-nums ${
                    isPositiveChange ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {isPositiveChange ? "+" : ""}{netWorthChangePct.toFixed(1)}% vs last month
                  </span>
                </div>
              )}
            </div>

            {/* Breakdown tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Bank</p>
                <p className="text-sm font-bold tabular-nums">{formatCurrency(bankBalance)}</p>
                {totalAssets > 0 && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {((bankBalance / totalAssets) * 100).toFixed(0)}% of assets
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Investments</p>
                <p className="text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(investmentValue)}</p>
                {totalAssets > 0 && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {((investmentValue / totalAssets) * 100).toFixed(0)}% of assets
                  </p>
                )}
              </div>
              {totalDebts > 0 && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Debts</p>
                  <p className="text-sm font-bold tabular-nums text-rose-600">-{formatCurrency(totalDebts)}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {totalAssets > 0 ? ((totalDebts / totalAssets) * 100).toFixed(0) : 0}% of assets
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Mini donut chart */}
          {assetData.length > 0 && (
            <div className="flex flex-col items-center justify-center">
              <PieChart width={140} height={140}>
                <Pie
                  data={assetData}
                  cx={70}
                  cy={70}
                  innerRadius={40}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {assetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<AssetPieTooltip />} />
              </PieChart>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                {assetData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[11px] text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Add/Edit Debt Dialog
// ---------------------------------------------------------------------------

function DebtFormDialog({
  open,
  onOpenChange,
  editingDebt,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingDebt: Debt | null
  onSubmit: (form: typeof EMPTY_DEBT_FORM) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_DEBT_FORM })

  useEffect(() => {
    if (editingDebt) {
      setForm({
        name: editingDebt.name,
        type: editingDebt.type,
        principal: String(editingDebt.principal),
        interestRate: String(editingDebt.interestRate),
        emiAmount: String(editingDebt.emiAmount),
        tenure: String(editingDebt.tenure),
        startDate: editingDebt.startDate,
        paidEMIs: String(editingDebt.paidEMIs),
        remainingBalance: String(editingDebt.remainingBalance),
      })
    } else {
      setForm({ ...EMPTY_DEBT_FORM })
    }
  }, [editingDebt, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingDebt ? "Edit Debt" : "Add Debt"}</DialogTitle>
          <DialogDescription>
            {editingDebt
              ? "Update the details for this debt entry."
              : "Enter the details for your new debt or loan."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input
                placeholder="e.g. Home Loan SBI"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type</Label>
              <Select value={form.type} onValueChange={(v) => updateField("type", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Principal Amount</Label>
              <Input
                type="number"
                placeholder="500000"
                value={form.principal}
                onChange={(e) => updateField("principal", e.target.value)}
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Interest Rate (%)</Label>
              <Input
                type="number"
                placeholder="8.5"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => updateField("interestRate", e.target.value)}
                min={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">EMI Amount</Label>
              <Input
                type="number"
                placeholder="15000"
                value={form.emiAmount}
                onChange={(e) => updateField("emiAmount", e.target.value)}
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tenure (months)</Label>
              <Input
                type="number"
                placeholder="240"
                value={form.tenure}
                onChange={(e) => updateField("tenure", e.target.value)}
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Paid EMIs</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.paidEMIs}
                onChange={(e) => updateField("paidEMIs", e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remaining Balance</Label>
              <Input
                type="number"
                placeholder="Leave blank for principal"
                value={form.remainingBalance}
                onChange={(e) => updateField("remainingBalance", e.target.value)}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingDebt ? "Update" : "Add Debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Debt Tracker Section
// ---------------------------------------------------------------------------

function DebtTrackerSection() {
  const queryClient = useQueryClient()
  const [showAddDebt, setShowAddDebt] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: debtsData, isLoading: debtsLoading } = useQuery<{
    success: boolean
    debts: Debt[]
  }>({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await fetch("/api/debts")
      if (!res.ok) throw new Error("Failed to fetch debts")
      return res.json()
    },
  })

  const debts = debtsData?.debts || []
  const activeDebts = debts.filter((d) => d.status === "active")
  const totalOutstanding = activeDebts.reduce((sum, d) => sum + d.remainingBalance, 0)
  const monthlyEMITotal = activeDebts.reduce((sum, d) => sum + d.emiAmount, 0)

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to create debt")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] })
      setShowAddDebt(false)
      toast.success("Debt added successfully")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/debts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to update debt")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] })
      setEditingDebt(null)
      toast.success("Debt updated successfully")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/debts?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete debt")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] })
      setDeletingId(null)
      toast.success("Debt deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setDeletingId(null)
    },
  })

  const handleFormSubmit = (form: typeof EMPTY_DEBT_FORM) => {
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      principal: Number(form.principal),
      interestRate: Number(form.interestRate),
      emiAmount: Number(form.emiAmount),
      tenure: Number(form.tenure),
      startDate: form.startDate,
      paidEMIs: Number(form.paidEMIs) || 0,
      remainingBalance: form.remainingBalance ? Number(form.remainingBalance) : Number(form.principal),
    }

    if (editingDebt) {
      updateMutation.mutate({ id: editingDebt.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    deleteMutation.mutate(id)
  }

  if (debtsLoading) {
    return (
      <motion.div variants={fadeUp}>
        <div className="card-elevated rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div variants={fadeUp}>
        <div className="card-elevated rounded-xl bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-rose-500/10">
                <IconCreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-sm font-semibold">Debt Tracker</h3>
              <InfoTooltip text="Track all your loans and credit card debts. Monitor EMI payments and remaining balances." />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAddDebt(true)}>
              <IconPlus className="h-4 w-4 mr-1" /> Add Debt
            </Button>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Total Outstanding
              </p>
              <p className="text-lg font-bold tabular-nums text-rose-600">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Active Debts
              </p>
              <p className="text-lg font-bold tabular-nums">
                {activeDebts.length}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Monthly EMI
              </p>
              <p className="text-lg font-bold tabular-nums">
                {formatCurrency(monthlyEMITotal)}
              </p>
            </div>
          </div>

          {/* Debt list */}
          {debts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12 px-6 bg-gradient-to-br from-muted/20 via-transparent to-muted/10">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 mb-4">
                <IconShieldCheck className="h-7 w-7 text-emerald-500" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Debt Free!</h4>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                No debts tracked. If you have any loans or credit card balances, add them here to monitor your payoff progress.
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowAddDebt(true)} className="gap-1.5">
                <IconPlus className="h-3.5 w-3.5" />
                Track a Debt
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {debts.map((debt) => {
                const progressPct =
                  debt.tenure > 0 ? (debt.paidEMIs / debt.tenure) * 100 : 0
                const monthsRemaining = Math.max(0, debt.tenure - debt.paidEMIs)
                const nextDue = calculateNextDueDate(debt.startDate, debt.paidEMIs)
                const isClosed = debt.status === "closed"

                return (
                  <div
                    key={debt.id}
                    className={`rounded-xl border p-4 transition-colors hover:bg-muted/20 ${
                      isClosed ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold truncate">{debt.name}</h4>
                          <Badge variant="outline" className="text-[11px] shrink-0">
                            {DEBT_TYPE_LABELS[debt.type] || debt.type}
                          </Badge>
                          {isClosed && (
                            <Badge variant="secondary" className="text-[11px] shrink-0">
                              Closed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(debt.remainingBalance)}{" "}
                          <span className="text-muted-foreground/60">
                            of {formatCurrency(debt.principal)}
                          </span>
                          {debt.interestRate > 0 && (
                            <span className="ml-2 text-muted-foreground/60">
                              @ {debt.interestRate}% p.a.
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditingDebt(debt)
                          }}
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(debt.id)}
                          disabled={deletingId === debt.id}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Progress
                      value={progressPct}
                      className="h-1.5 mb-2"
                    />

                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        EMI: <span className="font-medium text-foreground">{formatCurrency(debt.emiAmount)}</span>/mo
                      </span>
                      <span>
                        Paid: <span className="font-medium text-foreground">{debt.paidEMIs}</span>/{debt.tenure} EMIs
                      </span>
                      {!isClosed && monthsRemaining > 0 && (
                        <span>
                          {monthsRemaining} months left
                        </span>
                      )}
                      {!isClosed && (
                        <span>
                          Next due: <span className="font-medium text-foreground">{formatDate(nextDue)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Debt Dialog */}
      <DebtFormDialog
        open={showAddDebt}
        onOpenChange={setShowAddDebt}
        editingDebt={null}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Debt Dialog */}
      <DebtFormDialog
        open={!!editingDebt}
        onOpenChange={(open) => {
          if (!open) setEditingDebt(null)
        }}
        editingDebt={editingDebt}
        onSubmit={handleFormSubmit}
        isSubmitting={updateMutation.isPending}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Contextual CTAs based on health score
// ---------------------------------------------------------------------------

interface CtaAction {
  label: string
  href: string
  icon: React.ElementType
  variant: "default" | "outline"
}

function getCtaActions(score: number): { message: string; actions: CtaAction[] } {
  if (score < 30) {
    return {
      message:
        "Your score suggests focusing on building a solid financial foundation. Start with budgeting and setting clear savings goals.",
      actions: [
        { label: "Review Budget", href: "/budget", icon: IconWallet, variant: "default" },
        { label: "Set Savings Goal", href: "/goals", icon: IconPigMoney, variant: "outline" },
        { label: "Talk to AI Agent", href: "/agent", icon: IconRobot, variant: "outline" },
      ],
    }
  }
  if (score < 60) {
    return {
      message:
        "You are making progress. Optimizing your budget and growing your investments can push your score higher.",
      actions: [
        { label: "Optimize Budget", href: "/budget", icon: IconWallet, variant: "default" },
        { label: "Increase Investments", href: "/investments", icon: IconChartBar, variant: "outline" },
        { label: "Review Goals", href: "/goals", icon: IconChecklist, variant: "outline" },
      ],
    }
  }
  return {
    message:
      "Great work! You are in a strong position. Consider diversifying investments or setting new stretch goals.",
    actions: [
      { label: "Explore Investments", href: "/investments", icon: IconChartBar, variant: "default" },
      { label: "Set New Goals", href: "/goals", icon: IconTargetArrow, variant: "outline" },
    ],
  }
}

function ScoreCtaSection({ score }: { score: number }) {
  const { message, actions } = getCtaActions(score)

  return (
    <motion.div variants={fadeUp}>
      <div className="card-elevated rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <IconTargetArrow className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recommended Actions</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{message}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.href + action.label}
              variant={action.variant}
              size="sm"
              className="rounded-full gap-1.5"
              asChild
            >
              <Link href={action.href}>
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
                <IconArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function HealthLoadingSkeleton() {
  return (
    <div className="space-y-5">
      {/* Net Worth Hero skeleton */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-36 mt-2" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-[140px] w-[140px] rounded-full hidden md:block" />
        </div>
      </div>

      {/* Stat bar skeleton */}
      <div className="card-elevated rounded-xl grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
      {/* Score + Breakdown skeleton */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2 card-elevated rounded-xl p-6 flex flex-col items-center space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-[140px] w-[140px] rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="lg:col-span-3 card-elevated rounded-xl p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {/* Detail cards skeleton */}
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card-elevated rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      {/* Debt tracker skeleton */}
      <div className="card-elevated rounded-xl p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Chart skeleton */}
      <div className="card-elevated rounded-xl p-6">
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function FinancialHealthPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data, isLoading: loading, error: queryError } = useFinancialHealth()

  const metrics = data?.metrics ?? null
  const error = queryError ? "Failed to load financial health data" : null

  // Fetch debts for the hero net worth calculation
  const { data: debtsData } = useQuery<{ success: boolean; debts: Debt[] }>({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await fetch("/api/debts")
      if (!res.ok) throw new Error("Failed to fetch debts")
      return res.json()
    },
  })

  const totalDebts =
    debtsData?.debts
      ?.filter((d) => d.status === "active")
      ?.reduce((sum, d) => sum + d.remainingBalance, 0) || 0

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

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
  const stabilityPercent = metrics
    ? Math.round(metrics.incomeProfile.incomeStability * 100)
    : 0

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
          title="Financial Health"
          subtitle="Understanding your financial well-being"
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-5 p-4 md:p-6">
            {isLoading ? (
              <HealthLoadingSkeleton />
            ) : error ? (
              <div className="card-elevated rounded-xl flex h-64 items-center justify-center">
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : metrics ? (
              <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5">

                {/* --------------------------------------------------------- */}
                {/* 0. Net Worth Hero                                         */}
                {/* --------------------------------------------------------- */}
                <NetWorthHero metrics={metrics} totalDebts={totalDebts} />

                {/* --------------------------------------------------------- */}
                {/* 1. Unified Stat Bar (Enhanced)                            */}
                {/* --------------------------------------------------------- */}
                <motion.div
                  variants={fadeUp}
                  className="card-elevated rounded-xl grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40"
                >
                  <StatItem
                    icon={IconChartDonut}
                    label="Score"
                    value={String(Math.round(metrics.financialFreedomScore))}
                    suffix="/ 100"
                    colorClass={getScoreColor(metrics.financialFreedomScore)}
                    index={0}
                  />
                  <StatItem
                    icon={IconShieldCheck}
                    label="Safety Net"
                    value={metrics.emergencyFundMonths.toFixed(1)}
                    suffix="mo"
                    index={1}
                  />
                  <div className="max-sm:border-t max-sm:border-border/40">
                    <StatItem
                      icon={
                        metrics.expenseVelocity.trend === "decreasing"
                          ? IconTrendingDown
                          : IconTrendingUp
                      }
                      label="Spending Trend"
                      value={`${metrics.expenseVelocity.changePercent >= 0 ? "+" : ""}${metrics.expenseVelocity.changePercent.toFixed(1)}%`}
                      colorClass={
                        metrics.expenseVelocity.trend === "decreasing"
                          ? "text-emerald-600"
                          : metrics.expenseVelocity.trend === "increasing"
                            ? "text-rose-600"
                            : ""
                      }
                      index={2}
                    />
                  </div>
                  <div className="max-sm:border-t max-sm:border-border/40">
                    <StatItem
                      icon={IconActivity}
                      label="Income Consistency"
                      value={`${stabilityPercent}%`}
                      colorClass={stabilityPercent >= 70 ? "text-primary" : ""}
                      index={3}
                    />
                  </div>
                </motion.div>

                {/* --------------------------------------------------------- */}
                {/* 2. Score Ring + Score Breakdown                           */}
                {/* --------------------------------------------------------- */}
                <motion.div variants={fadeUp} className="grid gap-5 lg:grid-cols-5">
                  {/* Score Ring */}
                  <div className="lg:col-span-2 card-elevated rounded-xl p-6 flex flex-col items-center">
                    <div className="flex items-center gap-2 self-start mb-6">
                      <IconHeartbeat className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Health Score</h3>
                      <InfoTooltip text="A 0-100 composite score measuring your overall financial health. It combines balance growth, safety net, spending balance, and investment rate (25 points each)." />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <ScoreRing score={metrics.financialFreedomScore} />
                      <motion.span
                        variants={fadeUpSmall}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getScoreBadgeBg(metrics.financialFreedomScore)}`}
                      >
                        {getScoreLabel(metrics.financialFreedomScore)}
                      </motion.span>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="lg:col-span-3 card-elevated rounded-xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <IconChartLine className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Score Breakdown</h3>
                      </div>
                      <span className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                        25 pts each
                      </span>
                    </div>

                    <div className="space-y-1">
                      <BreakdownBar
                        label="Balance Growth"
                        score={metrics.scoreBreakdown.savingsRate}
                        maxScore={25}
                        tooltip="How much your balance grows each month. Positive growth = more points."
                        index={0}
                        icon={IconWallet}
                      />
                      <BreakdownBar
                        label="Safety Net"
                        score={metrics.scoreBreakdown.emergencyFund}
                        maxScore={25}
                        tooltip="How many months of expenses your bank balance can cover. Target: 6 months."
                        index={1}
                        icon={IconShieldCheck}
                      />
                      <BreakdownBar
                        label="Spending Balance"
                        score={metrics.scoreBreakdown.nwiAdherence}
                        maxScore={25}
                        tooltip="How closely your Needs/Wants/Investments/Savings split matches your targets."
                        index={2}
                        icon={IconTargetArrow}
                      />
                      <BreakdownBar
                        label="Investment Rate"
                        score={metrics.scoreBreakdown.investmentRate}
                        maxScore={25}
                        tooltip="Percentage of income allocated to investments (stocks, mutual funds, SIPs)."
                        index={3}
                        icon={IconChartLine}
                      />
                    </div>

                    <details className="mt-4">
                      <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        How is this calculated?
                      </summary>
                      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                        <p><strong>Balance Growth ({metrics.scoreBreakdown.savingsRate.toFixed(1)}/25):</strong> Based on monthly balance change.</p>
                        <p><strong>Safety Net ({metrics.scoreBreakdown.emergencyFund.toFixed(1)}/25):</strong> Months of expenses covered (target: 6).</p>
                        <p><strong>Spending Balance ({metrics.scoreBreakdown.nwiAdherence.toFixed(1)}/25):</strong> NWI split adherence.</p>
                        <p><strong>Investment Rate ({metrics.scoreBreakdown.investmentRate.toFixed(1)}/25):</strong> Income allocated to investments.</p>
                      </div>
                    </details>
                  </div>
                </motion.div>

                {/* --------------------------------------------------------- */}
                {/* 2b. Contextual CTAs based on score                       */}
                {/* --------------------------------------------------------- */}
                <ScoreCtaSection score={metrics.financialFreedomScore} />

                {/* --------------------------------------------------------- */}
                {/* 3. Spending Trend + Income Profile                        */}
                {/* --------------------------------------------------------- */}
                <motion.div variants={fadeUp} className="grid gap-5 lg:grid-cols-2">
                  {/* Spending Trend */}
                  <div className="card-elevated rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                      {metrics.expenseVelocity.trend === "decreasing" ? (
                        <IconTrendingDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="text-sm font-semibold">Spending Trend</h3>
                      <InfoTooltip text="Tracks whether your average monthly spending is rising or falling compared to the previous period." />
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      {/* Current */}
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current Avg
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatCurrency(metrics.expenseVelocity.currentMonthlyAvg)}
                        </p>
                      </div>

                      {/* Trend indicator */}
                      <div className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 ${
                        metrics.expenseVelocity.trend === "increasing"
                          ? "bg-rose-500/8"
                          : metrics.expenseVelocity.trend === "decreasing"
                            ? "bg-emerald-500/8"
                            : "bg-muted/30"
                      }`}>
                        {metrics.expenseVelocity.trend === "increasing" ? (
                          <IconArrowUpRight className="h-5 w-5 text-rose-500" />
                        ) : metrics.expenseVelocity.trend === "decreasing" ? (
                          <IconArrowDownRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <IconMinus className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className={`text-xs font-bold tabular-nums ${
                          metrics.expenseVelocity.trend === "increasing"
                            ? "text-rose-600"
                            : metrics.expenseVelocity.trend === "decreasing"
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                        }`}>
                          {metrics.expenseVelocity.changePercent >= 0 ? "+" : ""}
                          {metrics.expenseVelocity.changePercent.toFixed(1)}%
                        </span>
                      </div>

                      {/* Previous */}
                      <div className="rounded-lg bg-muted/30 p-3 text-right">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Previous Avg
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatCurrency(metrics.expenseVelocity.previousMonthlyAvg)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/40">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        metrics.expenseVelocity.trend === "increasing"
                          ? "text-rose-600"
                          : metrics.expenseVelocity.trend === "decreasing"
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                      }`}>
                        {metrics.expenseVelocity.trend === "increasing" ? (
                          <>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Expenses Rising — check top categories for savings opportunities
                          </>
                        ) : metrics.expenseVelocity.trend === "decreasing" ? (
                          <>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Expenses Falling — great progress
                          </>
                        ) : (
                          <>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            Expenses Stable
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Income Profile */}
                  <div className="card-elevated rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <IconCash className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Income Profile</h3>
                      <InfoTooltip text="Analyzes your income consistency. Higher stability means predictable earnings, which improves financial planning." />
                    </div>

                    {/* Avg Income - Prominent */}
                    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 via-transparent to-transparent px-5 py-4 mb-5">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Avg Monthly Income
                      </p>
                      <motion.p
                        variants={numberPop}
                        className="text-2xl font-extrabold tabular-nums tracking-tight"
                      >
                        {formatCurrency(metrics.incomeProfile.avgMonthlyIncome)}
                      </motion.p>
                    </div>

                    {/* Consistency bar - Enhanced */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground/90">Consistency</span>
                        <span className={`text-sm font-bold tabular-nums ${
                          stabilityPercent >= 70
                            ? "text-emerald-600"
                            : stabilityPercent >= 40
                              ? "text-amber-600"
                              : "text-rose-600"
                        }`}>
                          {stabilityPercent}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                        <svg width="100%" height="100%" className="rounded-full">
                          <defs>
                            <linearGradient id="consistency-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop
                                offset="0%"
                                stopColor={
                                  stabilityPercent >= 70 ? "#34d399" : stabilityPercent >= 40 ? "#fbbf24" : "#fb7185"
                                }
                                stopOpacity={0.7}
                              />
                              <stop
                                offset="100%"
                                stopColor={
                                  stabilityPercent >= 70 ? "#10b981" : stabilityPercent >= 40 ? "#f59e0b" : "#f43f5e"
                                }
                              />
                            </linearGradient>
                          </defs>
                          <motion.rect
                            x={0}
                            y={0}
                            height="100%"
                            rx={5}
                            ry={5}
                            fill="url(#consistency-grad)"
                            initial={{ width: 0 }}
                            animate={{ width: `${stabilityPercent}%` }}
                            transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                          />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stabilityPercent >= 80
                          ? "Very predictable — good for budgeting."
                          : stabilityPercent >= 50
                            ? "Somewhat variable. Budget based on your lowest month."
                            : "Fluctuates significantly. A larger safety net is recommended."}
                      </p>
                    </div>

                    {/* Income type + Last income */}
                    <div className="space-y-2 pt-3 border-t border-border/40">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Income Type</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md ${
                          metrics.incomeProfile.isVariable
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-emerald-500/10 text-emerald-600"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            metrics.incomeProfile.isVariable ? "bg-amber-500" : "bg-emerald-500"
                          }`} />
                          {metrics.incomeProfile.isVariable ? "Variable" : "Stable"}
                        </span>
                      </div>
                      {metrics.incomeProfile.lastIncomeDate && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Income</span>
                          <span className="text-xs font-medium flex items-center gap-1.5">
                            <IconCalendarStats className="h-3 w-3 text-muted-foreground" />
                            {new Date(metrics.incomeProfile.lastIncomeDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {stabilityPercent < 50 && (
                      <div className="mt-3 rounded-lg bg-amber-500/8 px-3 py-2">
                        <p className="text-xs text-amber-600">
                          Your income varies significantly. Consider building a larger safety net.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* --------------------------------------------------------- */}
                {/* 4. Debt Tracker                                           */}
                {/* --------------------------------------------------------- */}
                <DebtTrackerSection />

                {/* --------------------------------------------------------- */}
                {/* 5. Net Worth Timeline (Area Chart with Gradients)         */}
                {/* --------------------------------------------------------- */}
                <motion.div variants={fadeUp} className="card-elevated rounded-xl p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <IconWallet className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Net Worth Timeline</h3>
                      <InfoTooltip text="Bank balance is the running balance from your bank statement at each month-end. Investment value is the current total of stocks, mutual funds, and SIPs. Net worth = bank balance + investments. Note: investment values use today's valuation for all months (historical NAVs are not tracked)." />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
                        <span className="text-[11px] text-muted-foreground">Bank</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} />
                        <span className="text-[11px] text-muted-foreground">Investments</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Bank balance and investment value over time</p>

                  {metrics.netWorthTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={metrics.netWorthTimeline} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                        <defs>
                          <linearGradient id="bankGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="investGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickFormatter={formatCompactAxis}
                          width={55}
                        />
                        <Tooltip
                          content={<NetWorthTooltip />}
                          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                        />
                        <Area
                          dataKey="bankBalance"
                          type="monotone"
                          stroke="var(--chart-1)"
                          strokeWidth={2.5}
                          fill="url(#bankGradient)"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Area
                          dataKey="investmentValue"
                          type="monotone"
                          stroke="var(--chart-2)"
                          strokeWidth={2.5}
                          fill="url(#investGradient)"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-gradient-to-br from-muted/20 via-transparent to-muted/10">
                      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-muted/40 mb-3">
                        <IconChartLine className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No net worth data yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1 text-center max-w-xs">
                        Your net worth timeline will appear here once you have transaction history across multiple months.
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* --------------------------------------------------------- */}
                {/* 6. Emergency Fund Detail                                  */}
                {/* --------------------------------------------------------- */}
                <motion.div variants={fadeUp} className="card-elevated rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Emergency Fund</h3>
                    <InfoTooltip text="How many months of expenses your current bank balance can cover. The target is typically 6 months." />
                  </div>

                  <div className="grid grid-cols-2 gap-5 mb-5">
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Current Coverage
                      </p>
                      <motion.p
                        variants={numberPop}
                        className="text-3xl font-extrabold tabular-nums tracking-tight"
                      >
                        {metrics.emergencyFundMonths.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">months</span>
                      </motion.p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Target
                      </p>
                      <p className="text-3xl font-extrabold tabular-nums tracking-tight text-muted-foreground/60">
                        {metrics.emergencyFundTarget}
                        <span className="text-sm font-normal ml-1">months</span>
                      </p>
                    </div>
                  </div>

                  {/* Enhanced progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Progress</span>
                      <span className={`text-xs font-bold tabular-nums ${
                        metrics.emergencyFundMonths >= metrics.emergencyFundTarget
                          ? "text-emerald-600"
                          : metrics.emergencyFundMonths >= 3
                            ? "text-amber-600"
                            : "text-rose-600"
                      }`}>
                        {Math.min(
                          Math.round((metrics.emergencyFundMonths / metrics.emergencyFundTarget) * 100),
                          100
                        )}%
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
                      <svg width="100%" height="100%" className="rounded-full">
                        <defs>
                          <linearGradient id="emergency-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop
                              offset="0%"
                              stopColor={
                                metrics.emergencyFundMonths >= metrics.emergencyFundTarget
                                  ? "#34d399"
                                  : metrics.emergencyFundMonths >= 3
                                    ? "#fbbf24"
                                    : "#fb7185"
                              }
                              stopOpacity={0.7}
                            />
                            <stop
                              offset="100%"
                              stopColor={
                                metrics.emergencyFundMonths >= metrics.emergencyFundTarget
                                  ? "#10b981"
                                  : metrics.emergencyFundMonths >= 3
                                    ? "#f59e0b"
                                    : "#f43f5e"
                              }
                            />
                          </linearGradient>
                        </defs>
                        <motion.rect
                          x={0}
                          y={0}
                          height="100%"
                          rx={6}
                          ry={6}
                          fill="url(#emergency-grad)"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(
                              (metrics.emergencyFundMonths / metrics.emergencyFundTarget) * 100,
                              100
                            )}%`,
                          }}
                          transition={{ delay: 0.2, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5">
                      {metrics.emergencyFundMonths >= metrics.emergencyFundTarget ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          You have met your emergency fund target.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {(metrics.emergencyFundTarget - metrics.emergencyFundMonths).toFixed(1)} more months of coverage needed.
                        </span>
                      )}
                    </p>
                    <div className="mt-4 pt-3 border-t border-border/40">
                      <Link
                        href="/goals"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        <IconPigMoney className="h-3.5 w-3.5" />
                        Set emergency fund goal
                        <IconArrowRight className="h-3 w-3 opacity-60" />
                      </Link>
                    </div>
                  </div>
                </motion.div>

              </motion.div>
            ) : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
