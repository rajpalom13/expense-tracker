"use client"

import * as React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconAdjustments,
  IconArrowRight,
  IconBulb,
  IconCalculator,
  IconCash,
  IconCheck,
  IconChartPie,
  IconDeviceFloppy,
  IconHome,
  IconInfoCircle,
  IconMinus,
  IconPigMoney,
  IconPlus,
  IconShoppingCart,
  IconSparkles,
  IconTarget,
  IconTrash,
  IconTrendingUp,
  IconBuildingBank,
  IconRefresh,
  IconAlertTriangle,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react"

import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useAiInsight } from "@/hooks/use-ai-insights"
import type { PlannerRecommendationData } from "@/lib/ai-types"
import { stagger, fadeUp, fadeUpSmall } from "@/lib/motion"
import { formatINR, formatCompact } from "@/lib/format"

// ─── Types ───

interface InvestmentItem {
  id: string
  label: string
  amount: number
}

interface LinkedGoal {
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  percentageComplete: number
}

interface LinkedData {
  goals: LinkedGoal[] | null
  budgetConfig: { needs: number; wants: number; investments: number; savings: number } | null
  sips: { totalMonthly: number; count: number } | null
  stocks: { totalInvested: number; count: number } | null
  actualSpending: { monthlyIncome: number; monthlyExpenses: number; savingsRate: number } | null
}

const DEFAULT_INVESTMENT_TYPES = [
  { id: "sips", label: "SIPs" },
  { id: "ppf", label: "PPF" },
  { id: "stocks", label: "Stocks" },
  { id: "fd", label: "Fixed Deposits" },
  { id: "nps", label: "NPS" },
]

const CATEGORY_COLORS: Record<string, string> = {
  investments: "var(--chart-4)",
  savings: "var(--chart-1)",
  needs: "var(--chart-3)",
  wants: "var(--chart-5)",
  unallocated: "var(--muted-foreground)",
}

const INVESTMENT_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--muted-foreground)", "var(--primary)", "var(--accent-foreground)",
]

// ─── Helpers ───

function pct(amount: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((amount / total) * 1000) / 10
}

function formatPct(amount: number, total: number): string {
  return `${pct(amount, total).toFixed(1)}%`
}

// ─── Main ───

export default function PlannerPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Plan state
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [investmentItems, setInvestmentItems] = useState<InvestmentItem[]>(
    DEFAULT_INVESTMENT_TYPES.map((t) => ({ ...t, amount: 0 }))
  )
  const [savings, setSavings] = useState(0)
  const [goalAllocations, setGoalAllocations] = useState<Record<string, number>>({})
  const [needs, setNeeds] = useState(0)
  const [wants, setWants] = useState(0)
  const [customLabel, setCustomLabel] = useState("")

  // Linked data
  const [linked, setLinked] = useState<LinkedData>({
    goals: null,
    budgetConfig: null,
    sips: null,
    stocks: null,
    actualSpending: null,
  })

  // ─── Section Nav ───

  const SECTION_NAV = useMemo(() => [
    { id: "overview", label: "Overview" },
    { id: "income-investments", label: "Income" },
    { id: "allocation", label: "Allocation" },
    { id: "what-if", label: "What-If" },
    { id: "goals", label: "Goals" },
    { id: "ai-analysis", label: "AI Analysis" },
    { id: "portfolio-tips", label: "Portfolio" },
  ], [])

  const [activeSection, setActiveSection] = useState("overview")
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          sectionRefs.current.set(entry.target.id, entry)
        }
        // Find the topmost visible section
        let topSection: string | null = null
        let topY = Infinity
        for (const [id, entry] of sectionRefs.current.entries()) {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top
            topSection = id
          }
        }
        if (topSection) setActiveSection(topSection)
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    )

    // Observe all sections after a short delay to let DOM render
    const timer = setTimeout(() => {
      for (const sec of SECTION_NAV) {
        const el = document.getElementById(sec.id)
        if (el) observer.observe(el)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [SECTION_NAV])

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login")
  }, [authLoading, isAuthenticated, router])

  // Load saved plan + linked data
  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/planner", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        if (data.plan) {
          const p = data.plan
          setMonthlyIncome(p.monthlyIncome || 0)
          setSavings(p.savings || 0)
          setNeeds(p.needs || 0)
          setWants(p.wants || 0)
          if (p.goalAllocations && typeof p.goalAllocations === "object") {
            setGoalAllocations(p.goalAllocations as Record<string, number>)
          }

          if (p.investments && typeof p.investments === "object") {
            const items: InvestmentItem[] = []
            for (const def of DEFAULT_INVESTMENT_TYPES) {
              items.push({ id: def.id, label: def.label, amount: Number(p.investments[def.id]) || 0 })
            }
            for (const [key, val] of Object.entries(p.investments)) {
              if (!DEFAULT_INVESTMENT_TYPES.find((d) => d.id === key)) {
                items.push({ id: key, label: key, amount: Number(val) || 0 })
              }
            }
            setInvestmentItems(items)
          }
        }
        if (data.linked) setLinked(data.linked)
      }
    } catch {
      // first time
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    loadPlan()
  }, [isAuthenticated, loadPlan])

  // Derived values
  const totalInvestments = useMemo(() => investmentItems.reduce((s, i) => s + i.amount, 0), [investmentItems])
  const totalAllocated = totalInvestments + savings + needs + wants
  const unallocated = Math.max(monthlyIncome - totalAllocated, 0)
  const overAllocated = totalAllocated > monthlyIncome ? totalAllocated - monthlyIncome : 0

  // Pie chart data
  const pieData = useMemo(() => {
    const slices = [
      { name: "Investments", value: totalInvestments, color: CATEGORY_COLORS.investments },
      { name: "Savings", value: savings, color: CATEGORY_COLORS.savings },
      { name: "Needs", value: needs, color: CATEGORY_COLORS.needs },
      { name: "Wants", value: wants, color: CATEGORY_COLORS.wants },
    ].filter((s) => s.value > 0)
    if (unallocated > 0) slices.push({ name: "Unallocated", value: unallocated, color: CATEGORY_COLORS.unallocated })
    return slices
  }, [totalInvestments, savings, needs, wants, unallocated])

  const investmentPieData = useMemo(
    () => investmentItems.filter((i) => i.amount > 0).map((i, idx) => ({
      name: i.label, value: i.amount, color: INVESTMENT_COLORS[idx % INVESTMENT_COLORS.length],
    })),
    [investmentItems]
  )

  // ─── What-If Simulator ───

  const [whatIfAdjustments, setWhatIfAdjustments] = useState<Record<string, number>>({})

  const whatIfCategories = useMemo(() => {
    const cats = [
      { name: "Needs", actual: needs, color: CATEGORY_COLORS.needs },
      { name: "Wants", actual: wants, color: CATEGORY_COLORS.wants },
      { name: "Savings", actual: savings, color: CATEGORY_COLORS.savings },
      { name: "Investments", actual: totalInvestments, color: CATEGORY_COLORS.investments },
    ].filter((c) => c.actual > 0)

    return cats.map((c) => ({
      ...c,
      adjusted: whatIfAdjustments[c.name] ?? c.actual,
    }))
  }, [needs, wants, savings, totalInvestments, whatIfAdjustments])

  const whatIfMonthlySavingsChange = useMemo(() => {
    // Positive = user is spending less overall (saving more)
    // For Needs/Wants: spending less = saving more
    // For Savings/Investments: allocating more = saving more
    return whatIfCategories.reduce((sum, cat) => {
      if (cat.name === "Savings" || cat.name === "Investments") {
        return sum + (cat.adjusted - cat.actual)
      }
      return sum + (cat.actual - cat.adjusted)
    }, 0)
  }, [whatIfCategories])

  const whatIfCurrentSavingsRate = useMemo(() => {
    if (monthlyIncome <= 0) return 0
    return ((savings + totalInvestments) / monthlyIncome) * 100
  }, [monthlyIncome, savings, totalInvestments])

  const whatIfNewSavingsRate = useMemo(() => {
    if (monthlyIncome <= 0) return 0
    const currentSavingsInvestments = savings + totalInvestments
    const newSavingsInvestments = currentSavingsInvestments + whatIfMonthlySavingsChange
    return (newSavingsInvestments / monthlyIncome) * 100
  }, [monthlyIncome, savings, totalInvestments, whatIfMonthlySavingsChange])

  const whatIfEmergencyMonths = useMemo(() => {
    // Calculate how much faster you reach 6 months emergency fund
    const currentMonthlySaved = savings + totalInvestments
    const newMonthlySaved = currentMonthlySaved + whatIfMonthlySavingsChange
    const monthlyExpensesActual = linked.actualSpending?.monthlyExpenses || (needs + wants)
    if (monthlyExpensesActual <= 0) return 0
    const targetFund = monthlyExpensesActual * 6
    if (currentMonthlySaved <= 0 && newMonthlySaved <= 0) return 0
    const currentMonths = currentMonthlySaved > 0 ? targetFund / currentMonthlySaved : Infinity
    const newMonths = newMonthlySaved > 0 ? targetFund / newMonthlySaved : Infinity
    const monthsSaved = currentMonths - newMonths
    return isFinite(monthsSaved) ? monthsSaved : 0
  }, [savings, totalInvestments, whatIfMonthlySavingsChange, needs, wants, linked.actualSpending])

  const handleWhatIfAdjust = useCallback((name: string, value: number) => {
    setWhatIfAdjustments((prev) => ({ ...prev, [name]: Math.max(0, value) }))
  }, [])

  const nudgeWhatIf = useCallback((name: string, delta: number) => {
    setWhatIfAdjustments((prev) => {
      const cat = whatIfCategories.find((c) => c.name === name)
      const current = prev[name] ?? cat?.actual ?? 0
      return { ...prev, [name]: Math.max(0, current + delta) }
    })
  }, [whatIfCategories])

  const resetWhatIf = useCallback(() => {
    setWhatIfAdjustments({})
  }, [])

  const whatIfHasChanges = useMemo(() => {
    return whatIfCategories.some((c) => c.adjusted !== c.actual)
  }, [whatIfCategories])

  // Plan vs Actual bar data
  const planVsActual = useMemo(() => {
    if (!linked.actualSpending || monthlyIncome <= 0) return []
    const actual = linked.actualSpending
    return [
      { category: "Income", planned: monthlyIncome, actual: actual.monthlyIncome },
      { category: "Expenses", planned: needs + wants, actual: actual.monthlyExpenses },
      { category: "Invest+Save", planned: totalInvestments + savings, actual: Math.max(actual.monthlyIncome - actual.monthlyExpenses, 0) },
    ]
  }, [monthlyIncome, needs, wants, totalInvestments, savings, linked.actualSpending])

  // ─── Handlers ───

  const updateInvestment = useCallback((id: string, amount: number) => {
    setInvestmentItems((prev) => prev.map((item) => (item.id === id ? { ...item, amount } : item)))
    setSaved(false)
  }, [])

  const removeInvestment = useCallback((id: string) => {
    setInvestmentItems((prev) => prev.filter((item) => item.id !== id))
    setSaved(false)
  }, [])

  const addCustomInvestment = useCallback(() => {
    const label = customLabel.trim()
    if (!label) return
    const id = label.toLowerCase().replace(/\s+/g, "_")
    if (investmentItems.find((i) => i.id === id)) { toast.error("Already exists"); return }
    setInvestmentItems((prev) => [...prev, { id, label, amount: 0 }])
    setCustomLabel("")
    setSaved(false)
  }, [customLabel, investmentItems])

  const autoAllocate = useCallback(() => {
    if (monthlyIncome <= 0) { toast.error("Enter your monthly income first"); return }
    // Use budget config percentages if available, else 50/30/20
    const cfg = linked.budgetConfig
    const needsPct = cfg ? cfg.needs / 100 : 0.5
    const wantsPct = cfg ? cfg.wants / 100 : 0.3
    const invPct = cfg ? cfg.investments / 100 : 0.12
    const savPct = cfg ? cfg.savings / 100 : 0.08

    const rawNeeds = Math.round(monthlyIncome * needsPct)
    const rawWants = Math.round(monthlyIncome * wantsPct)
    const rawInv = Math.round(monthlyIncome * invPct)
    // Give remainder to savings to avoid rounding overshoot
    const rawSav = monthlyIncome - rawNeeds - rawWants - rawInv
    setNeeds(rawNeeds)
    setWants(rawWants)
    setSavings(Math.max(rawSav, 0))
    const totalInv = rawInv
    const perItem = Math.floor(totalInv / Math.max(investmentItems.length, 1))
    setInvestmentItems((prev) => prev.map((item) => ({ ...item, amount: perItem })))
    setSaved(false)
    toast.success(cfg ? "Allocated using your budget ratios" : "Allocated using 50/30/20 rule")
  }, [monthlyIncome, investmentItems.length, linked.budgetConfig])

  const savePlan = useCallback(async () => {
    setSaving(true)
    try {
      const investments: Record<string, number> = {}
      for (const item of investmentItems) investments[item.id] = item.amount
      const res = await fetch("/api/planner", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyIncome, investments, savings, needs, wants, goalAllocations }),
      })
      const data = await res.json()
      if (data.success) { setSaved(true); toast.success("Plan saved") }
      else toast.error(data.message || "Failed to save plan")
    } catch { toast.error("Failed to save plan") }
    finally { setSaving(false) }
  }, [monthlyIncome, investmentItems, savings, needs, wants, goalAllocations])

  // ─── Tooltips ───

  const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.payload.color }} />
          <span className="text-sm font-medium">{d.name}</span>
        </div>
        <p className="text-sm text-muted-foreground">{formatINR(d.value)} ({formatPct(d.value, monthlyIncome)})</p>
      </div>
    )
  }

  const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-lg">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="capitalize">{p.dataKey}</span>
            <span className="font-medium tabular-nums">{formatINR(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // ─── Shell wrapper (sidebar + header) ───

  const shell = (children: React.ReactNode) => (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="Finance Planner"
          subtitle="Monthly allocation"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={autoAllocate} className="gap-1.5">
                <IconCalculator className="h-4 w-4" />
                <span className="hidden sm:inline">{linked.budgetConfig ? "Use Budget Ratios" : "50/30/20"}</span>
              </Button>
              <Button size="sm" onClick={savePlan} disabled={saving} className="gap-1.5">
                {saved ? <IconCheck className="h-4 w-4" /> : <IconDeviceFloppy className="h-4 w-4" />}
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </Button>
            </div>
          }
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )

  // ─── Render ───

  if (authLoading || loading) {
    return shell(
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      </div>
    )
  }

  return shell(
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {/* ─── Sticky Section Nav ─── */}
      <nav className="sticky top-0 z-10 -mx-4 -mt-4 md:-mx-6 md:-mt-6 mb-0 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 md:px-6" style={{ scrollbarWidth: "none" }}>
          {SECTION_NAV.map((sec) => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSection === sec.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </nav>

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* ─── Row 1: Quick Stats ─── */}
            <motion.div id="overview" variants={fadeUp} className="grid gap-3 grid-cols-2 lg:grid-cols-4 scroll-mt-14">
              <StatCard
                icon={IconCash}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-500"
                label="Monthly Income"
                value={monthlyIncome > 0 ? formatINR(monthlyIncome) : "—"}
                sub={monthlyIncome > 0 ? `${formatCompact(monthlyIncome * 12)}/yr` : "Set below"}
              />
              <StatCard
                icon={IconTrendingUp}
                iconBg="bg-indigo-500/10"
                iconColor="text-indigo-500"
                label="Planned Investments"
                value={totalInvestments > 0 ? formatINR(totalInvestments) : "—"}
                sub={monthlyIncome > 0 && totalInvestments > 0 ? `${formatPct(totalInvestments, monthlyIncome)} of income` : linked.sips ? `${linked.sips.count} SIPs active` : "—"}
              />
              <StatCard
                icon={IconPigMoney}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-500"
                label="Planned Savings"
                value={savings > 0 ? formatINR(savings) : "—"}
                sub={linked.actualSpending ? `Actual: ${linked.actualSpending.savingsRate.toFixed(0)}% rate` : "—"}
              />
              <StatCard
                icon={IconTarget}
                iconBg="bg-violet-500/10"
                iconColor="text-violet-500"
                label="Active Goals"
                value={linked.goals ? `${linked.goals.length}` : "—"}
                sub={linked.goals && linked.goals.length > 0
                  ? `${formatINR(linked.goals.reduce((s, g) => s + g.targetAmount, 0))} target`
                  : "No goals set"}
              />
            </motion.div>

            {/* ─── Row 2: Income + Investments | Pie Chart + Investment Split ─── */}
            <div id="income-investments" className="grid gap-5 lg:grid-cols-2 items-stretch scroll-mt-14">
              {/* Left: Income + Investments */}
              <motion.div variants={fadeUpSmall} className="flex flex-col gap-4">
                {/* Income */}
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                      <IconCash className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-sm font-semibold">Monthly Income</h2>
                      <p className="text-[11px] text-muted-foreground">Expected monthly earning</p>
                    </div>
                    {linked.actualSpending && linked.actualSpending.monthlyIncome > 0 && (
                      <Badge variant="secondary" className="text-[11px] tabular-nums">
                        Actual: {formatINR(linked.actualSpending.monthlyIncome)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      value={monthlyIncome || ""}
                      onChange={(e) => { setMonthlyIncome(Number(e.target.value) || 0); setSaved(false) }}
                      placeholder="0"
                      className="text-base font-semibold tabular-nums max-w-[200px]"
                    />
                    {monthlyIncome > 0 && (
                      <Badge variant="secondary" className="text-xs tabular-nums">{formatCompact(monthlyIncome * 12)}/yr</Badge>
                    )}
                  </div>
                </div>

                {/* Investments */}
                <div className="rounded-xl border border-border/60 bg-card p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                        <IconTrendingUp className="h-4 w-4 text-indigo-500" />
                      </div>
                      <h2 className="text-sm font-semibold">Investments</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {linked.sips && linked.sips.totalMonthly > 0 && (
                        <Badge variant="secondary" className="text-[11px] tabular-nums">
                          SIPs: {formatINR(linked.sips.totalMonthly)}/mo
                        </Badge>
                      )}
                      {totalInvestments > 0 && (
                        <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-xs tabular-nums">
                          {formatINR(totalInvestments)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 flex-1 flex flex-col justify-between">
                    {investmentItems.map((item) => {
                      const isDefault = DEFAULT_INVESTMENT_TYPES.some((d) => d.id === item.id)
                      return (
                        <div key={item.id} className="flex items-center gap-2">
                          <Label className="w-24 text-xs font-medium text-muted-foreground shrink-0 truncate">{item.label}</Label>
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                            <Input type="number" value={item.amount || ""} onChange={(e) => updateInvestment(item.id, Number(e.target.value) || 0)} placeholder="0" className="pl-6 text-sm tabular-nums h-8" />
                          </div>
                          {monthlyIncome > 0 && item.amount > 0 && (
                            <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right shrink-0">{formatPct(item.amount, monthlyIncome)}</span>
                          )}
                          {!isDefault && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeInvestment(item.id)}>
                              <IconTrash className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Custom (e.g. Gold, Crypto)" className="text-sm h-8" onKeyDown={(e) => e.key === "Enter" && addCustomInvestment()} />
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={addCustomInvestment} disabled={!customLabel.trim()}>
                        <IconPlus className="h-3.5 w-3.5" />Add
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right: Pie charts */}
              <motion.div variants={fadeUpSmall} className="flex flex-col gap-4">
                {/* Income Breakdown Pie */}
                <div className="rounded-xl border border-border/60 bg-card p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <IconChartPie className="h-4 w-4 text-violet-500" />
                    </div>
                    <h2 className="text-sm font-semibold">Income Breakdown</h2>
                  </div>
                  {monthlyIncome > 0 && pieData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={true} animationDuration={400} animationBegin={0}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground min-h-48">Enter your income to see the breakdown</div>
                  )}
                  {monthlyIncome > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground truncate">{d.name}</p>
                            <p className="text-xs font-semibold tabular-nums">{formatCompact(d.value)}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatPct(d.value, monthlyIncome)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Investment Split Pie */}
                {investmentPieData.length > 1 && (
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                        <IconBuildingBank className="h-4 w-4 text-indigo-500" />
                      </div>
                      <h2 className="text-sm font-semibold">Investment Split</h2>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={investmentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={true} animationDuration={400} animationBegin={0}>
                            {investmentPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {investmentPieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-medium tabular-nums">{formatPct(d.value, totalInvestments)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ─── Row 3: Savings / Needs / Wants ─── */}
            <motion.div id="allocation" variants={fadeUpSmall} className="grid gap-4 lg:grid-cols-3 scroll-mt-14">
              {/* Savings — expanded with goal allocation */}
              <div className="rounded-xl border border-border/60 bg-card p-4 lg:col-span-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <IconPigMoney className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight">Savings</h3>
                    <p className="text-[11px] text-muted-foreground leading-snug">Emergency fund, liquid cash</p>
                  </div>
                  {linked.budgetConfig?.savings != null && (
                    <Badge variant="outline" className="text-[11px] tabular-nums shrink-0">Budget: {linked.budgetConfig.savings}%</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                    <Input type="number" value={savings || ""} onChange={(e) => { setSavings(Number(e.target.value) || 0); setSaved(false) }} placeholder="0" className="pl-6 text-sm tabular-nums h-8" />
                  </div>
                  {monthlyIncome > 0 && savings > 0 && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[11px] tabular-nums shrink-0">{formatPct(savings, monthlyIncome)}</Badge>
                  )}
                </div>
                {/* Goal allocations */}
                {linked.goals && linked.goals.length > 0 && (
                  <div className="border-t border-border/40 pt-2.5 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Allocate to goals</p>
                    {linked.goals.map((goal) => {
                      const alloc = goalAllocations[goal.name] || 0
                      return (
                        <div key={goal.name} className="flex items-center gap-2">
                          <IconTarget className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{goal.name}</span>
                          <div className="relative w-24 shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">₹</span>
                            <Input
                              type="number"
                              value={alloc || ""}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0
                                setGoalAllocations((prev) => ({ ...prev, [goal.name]: v }))
                                setSaved(false)
                              }}
                              placeholder="0"
                              className="pl-5 text-xs tabular-nums h-7"
                            />
                          </div>
                        </div>
                      )
                    })}
                    {(() => {
                      const totalGoalAlloc = Object.values(goalAllocations).reduce((s, v) => s + v, 0)
                      const remaining = savings - totalGoalAlloc
                      return totalGoalAlloc > 0 ? (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/30">
                          <span className="text-muted-foreground">Unassigned savings</span>
                          <span className={`font-medium tabular-nums ${remaining < 0 ? "text-destructive" : "text-emerald-500"}`}>
                            {formatINR(Math.abs(remaining))}{remaining < 0 ? " over" : ""}
                          </span>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
              <AllocationCard
                icon={IconHome} iconBg="bg-amber-500/10" iconColor="text-amber-500"
                label="Needs" hint="Rent, bills, groceries, EMIs" value={needs}
                onChange={(v) => { setNeeds(v); setSaved(false) }}
                pctStr={monthlyIncome > 0 ? formatPct(needs, monthlyIncome) : undefined}
                badgeColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                budgetPct={linked.budgetConfig?.needs}
              />
              <AllocationCard
                icon={IconShoppingCart} iconBg="bg-pink-500/10" iconColor="text-pink-500"
                label="Wants" hint="Entertainment, dining, shopping" value={wants}
                onChange={(v) => { setWants(v); setSaved(false) }}
                pctStr={monthlyIncome > 0 ? formatPct(wants, monthlyIncome) : undefined}
                badgeColor="bg-pink-500/10 text-pink-600 dark:text-pink-400"
                budgetPct={linked.budgetConfig?.wants}
              />
            </motion.div>

            {/* ─── Row 4: Allocation Summary ─── */}
            {monthlyIncome > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Allocation Summary</h3>
                  {overAllocated > 0 ? (
                    <Badge variant="destructive" className="text-xs tabular-nums">Over by {formatINR(overAllocated)}</Badge>
                  ) : unallocated > 0 ? (
                    <Badge variant="secondary" className="text-xs tabular-nums">{formatINR(unallocated)} unallocated</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-xs">Fully allocated</Badge>
                  )}
                </div>
                <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden flex">
                  {totalInvestments > 0 && <div className="h-full transition-all duration-300" style={{ width: `${Math.min(pct(totalInvestments, monthlyIncome), 100)}%`, backgroundColor: CATEGORY_COLORS.investments }} />}
                  {savings > 0 && <div className="h-full transition-all duration-300" style={{ width: `${Math.min(pct(savings, monthlyIncome), 100)}%`, backgroundColor: CATEGORY_COLORS.savings }} />}
                  {needs > 0 && <div className="h-full transition-all duration-300" style={{ width: `${Math.min(pct(needs, monthlyIncome), 100)}%`, backgroundColor: CATEGORY_COLORS.needs }} />}
                  {wants > 0 && <div className="h-full transition-all duration-300" style={{ width: `${Math.min(pct(wants, monthlyIncome), 100)}%`, backgroundColor: CATEGORY_COLORS.wants }} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {[
                    { label: "Investments", color: CATEGORY_COLORS.investments, value: totalInvestments },
                    { label: "Savings", color: CATEGORY_COLORS.savings, value: savings },
                    { label: "Needs", color: CATEGORY_COLORS.needs, value: needs },
                    { label: "Wants", color: CATEGORY_COLORS.wants, value: wants },
                  ].filter((l) => l.value > 0).map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="text-muted-foreground">{l.label}</span>
                      <span className="font-medium tabular-nums">{formatINR(l.value)}</span>
                      <span className="text-muted-foreground/60 tabular-nums">({formatPct(l.value, monthlyIncome)})</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ─── Row 5: What-If Simulator ─── */}
            {monthlyIncome > 0 && whatIfCategories.length > 0 && (
              <motion.div id="what-if" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="rounded-xl border border-border/60 bg-card p-5 scroll-mt-14">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-500/10">
                    <IconAdjustments className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h3 className="text-sm font-semibold">What-If Simulator</h3>
                  <Badge variant="outline" className="ml-auto text-xs">Interactive</Badge>
                </div>

                {/* Category adjustments */}
                <div className="space-y-4 mb-6">
                  {whatIfCategories.map((cat) => (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-sm font-medium">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Current: {formatINR(cat.actual)}</span>
                          <span className="text-sm font-bold tabular-nums">{formatINR(cat.adjusted)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(cat.actual * 2, 1000)}
                          step={500}
                          value={cat.adjusted}
                          onChange={(e) => handleWhatIfAdjust(cat.name, Number(e.target.value))}
                          className="flex-1 h-1.5 accent-primary cursor-pointer"
                        />
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => nudgeWhatIf(cat.name, -500)}>
                            <IconMinus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => nudgeWhatIf(cat.name, 500)}>
                            <IconPlus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {cat.adjusted !== cat.actual && (
                        <p className={`text-xs ${
                          (cat.name === "Savings" || cat.name === "Investments")
                            ? (cat.adjusted > cat.actual ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")
                            : (cat.adjusted < cat.actual ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")
                        }`}>
                          {cat.adjusted < cat.actual ? "\u2193" : "\u2191"} {formatINR(Math.abs(cat.adjusted - cat.actual))}{" "}
                          ({cat.adjusted < cat.actual ? "saving" : "spending"}{" "}
                          {cat.actual > 0 ? ((Math.abs(cat.adjusted - cat.actual) / cat.actual) * 100).toFixed(0) : 0}%{" "}
                          {cat.adjusted < cat.actual ? "less" : "more"})
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Impact Summary */}
                {whatIfHasChanges && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Impact Summary</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <ImpactCard
                        label="Monthly Savings Change"
                        value={whatIfMonthlySavingsChange}
                        isPositive={whatIfMonthlySavingsChange > 0}
                      />
                      <ImpactCard
                        label="Annual Impact"
                        value={whatIfMonthlySavingsChange * 12}
                        isPositive={whatIfMonthlySavingsChange > 0}
                      />
                      <ImpactCard
                        label="New Savings Rate"
                        value={`${whatIfNewSavingsRate.toFixed(1)}%`}
                        subtitle={`was ${whatIfCurrentSavingsRate.toFixed(1)}%`}
                        isPositive={whatIfNewSavingsRate > whatIfCurrentSavingsRate}
                      />
                      <ImpactCard
                        label="Emergency Fund"
                        value={whatIfEmergencyMonths > 0 ? `${whatIfEmergencyMonths.toFixed(1)} mo faster` : whatIfEmergencyMonths < 0 ? `${Math.abs(whatIfEmergencyMonths).toFixed(1)} mo slower` : "No change"}
                        subtitle="toward 6-month target"
                        isPositive={whatIfEmergencyMonths > 0}
                      />
                    </div>
                  </div>
                )}

                {/* Reset button */}
                {whatIfHasChanges && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={resetWhatIf} className="gap-1.5">
                      <IconRefresh className="h-4 w-4" /> Reset All
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Row 6: Plan vs Actual + Linked Goals ───*/}
            <div id="goals" className={`grid gap-5 scroll-mt-14 ${planVsActual.length > 0 ? "lg:grid-cols-2" : ""}`}>
              {/* Plan vs Actual */}
              {planVsActual.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                      <IconBulb className="h-4 w-4 text-sky-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">Plan vs Actual</h2>
                      <p className="text-[11px] text-muted-foreground">This month&apos;s reality check</p>
                    </div>
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planVsActual} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                        <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                        <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={55} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="planned" fill="var(--chart-4)" radius={[4, 4, 0, 0]} barSize={20} name="Planned" />
                        <Bar dataKey="actual" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={20} name="Actual" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-chart-4" />Planned</div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-chart-1" />Actual (this month)</div>
                  </div>
                </motion.div>
              )}

              {/* Linked Goals */}
              <motion.div variants={fadeUpSmall} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <IconTarget className="h-4 w-4 text-violet-500" />
                    </div>
                    <h2 className="text-sm font-semibold">Savings Goals</h2>
                  </div>
                  <Link href="/goals" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <IconArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {linked.goals && linked.goals.length > 0 ? (
                  <div className="space-y-3">
                    {linked.goals.slice(0, 4).map((goal) => (
                      <div key={goal.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate max-w-[60%]">{goal.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatCompact(goal.currentAmount)} / {formatCompact(goal.targetAmount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-500 transition-all duration-300"
                              style={{ width: `${Math.min(goal.percentageComplete, 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
                            {goal.percentageComplete.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {linked.goals.length > 4 && (
                      <p className="text-xs text-muted-foreground">+{linked.goals.length - 4} more goals</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <IconTarget className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No savings goals yet</p>
                    <Link href="/goals" className="mt-2 text-xs text-primary hover:underline">Create your first goal</Link>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ─── Row 7: AI Plan Analysis ─── */}
            <div id="ai-analysis" className="scroll-mt-14">
              <PlannerAiSection />
            </div>

            {/* ─── Row 8: Tips + Portfolio Summary ─── */}
            <div id="portfolio-tips" className={`grid gap-5 scroll-mt-14 ${(linked.sips || linked.stocks) ? "lg:grid-cols-2" : ""}`}>
              {/* Portfolio Summary */}
              {(linked.sips || linked.stocks) && (
                <motion.div variants={fadeUpSmall} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                        <IconBuildingBank className="h-4 w-4 text-teal-500" />
                      </div>
                      <h2 className="text-sm font-semibold">Current Portfolio</h2>
                    </div>
                    <Link href="/investments" className="text-xs text-primary hover:underline flex items-center gap-1">
                      Details <IconArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {linked.sips && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-[11px] text-muted-foreground">Active SIPs</p>
                        <p className="text-lg font-bold tabular-nums">{linked.sips.count}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatINR(linked.sips.totalMonthly)}/mo</p>
                      </div>
                    )}
                    {linked.stocks && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-[11px] text-muted-foreground">Stocks Held</p>
                        <p className="text-lg font-bold tabular-nums">{linked.stocks.count}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatINR(linked.stocks.totalInvested)} invested</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Quick Tips */}
              <motion.div variants={fadeUpSmall} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start gap-2.5">
                  <IconInfoCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {linked.budgetConfig ? (
                      <p>
                        <strong className="text-foreground">Your budget ratios:</strong> Needs {linked.budgetConfig.needs}%, Wants {linked.budgetConfig.wants}%, Investments {linked.budgetConfig.investments}%, Savings {linked.budgetConfig.savings}%. Click &quot;Use Budget Ratios&quot; to auto-fill.
                      </p>
                    ) : (
                      <p>
                        <strong className="text-foreground">50/30/20 Rule:</strong> Allocate 50% to needs, 30% to wants, and 20% to savings + investments.
                      </p>
                    )}
                    <p>
                      <strong className="text-foreground">Tip:</strong> Try to invest at least 10-15% of your income for long-term wealth building.
                    </p>
                    {linked.actualSpending && linked.actualSpending.savingsRate < 10 && (
                      <p className="text-amber-600 dark:text-amber-400">
                        <strong>Warning:</strong> Your actual savings rate is only {linked.actualSpending.savingsRate.toFixed(0)}%. Consider reducing wants to boost savings.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

      </motion.div>
    </div>
  )
}

// ─── Sub-components ───

function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }: {
  icon: React.ElementType; iconBg: string; iconColor: string; label: string; value: string; sub: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-bold tabular-nums truncate">{value}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums truncate">{sub}</p>
        </div>
      </div>
    </div>
  )
}

interface AllocationCardProps {
  icon: React.ElementType; iconBg: string; iconColor: string; label: string; hint: string
  value: number; onChange: (v: number) => void; pctStr?: string; badgeColor: string
  budgetPct?: number
}

function AllocationCard({ icon: Icon, iconBg, iconColor, label, hint, value, onChange, pctStr, badgeColor, budgetPct }: AllocationCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{label}</h3>
          <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
        </div>
        {budgetPct != null && (
          <Badge variant="outline" className="text-[11px] tabular-nums shrink-0">Budget: {budgetPct}%</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <Input type="number" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} placeholder="0" className="pl-6 text-sm tabular-nums h-8" />
        </div>
        {pctStr && <Badge className={`${badgeColor} border-0 text-[11px] tabular-nums shrink-0`}>{pctStr}</Badge>}
      </div>
    </div>
  )
}

function ImpactCard({ label, value, isPositive, subtitle }: {
  label: string; value: number | string; isPositive?: boolean; subtitle?: string
}) {
  const displayValue = typeof value === "number"
    ? `${value >= 0 ? "+" : ""}${formatINR(value)}`
    : value
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${
        isPositive === true ? "text-emerald-600 dark:text-emerald-400" :
        isPositive === false ? "text-rose-600" : ""
      }`}>{displayValue}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

// ─── AI Plan Analysis Section ───

const PLAN_SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  positive: { border: "border-emerald-200/70 dark:border-emerald-800/50", bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-400" },
  warning: { border: "border-amber-200/70 dark:border-amber-800/50", bg: "bg-amber-50/50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-400" },
  critical: { border: "border-rose-200/70 dark:border-rose-800/50", bg: "bg-rose-50/50 dark:bg-rose-950/20", text: "text-rose-600 dark:text-rose-400" },
}

const PLAN_IMPACT_STYLES: Record<string, { dot: string; text: string }> = {
  high: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  medium: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  low: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
}

const PLAN_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: "On track", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  over: { label: "Over", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-900/40" },
  under: { label: "Under", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
}

function PlanScoreRing({ score }: { score: number }) {
  const radius = 42
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-rose-500"

  return (
    <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`${color} transition-all duration-1000 ease-out`} style={{ stroke: "currentColor" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{score}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

function PlannerAiSection() {
  const { structuredData, generatedAt, fromCache, stale, isLoading, isRegenerating, error, regenerate } = useAiInsight("planner_recommendation")
  const data = structuredData as PlannerRecommendationData | null
  const isWorking = isLoading || isRegenerating

  // Header — always shown
  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-500/15">
          <IconSparkles className="h-[18px] w-[18px] text-purple-600 dark:text-purple-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">AI Plan Analysis</h3>
          <p className="text-xs text-muted-foreground leading-snug">AI-powered assessment of your financial plan</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {fromCache && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Cached</span>
        )}
        {stale && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            <IconAlertTriangle className="h-3 w-3" /> Stale
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => regenerate()} disabled={isWorking} className="h-8 shrink-0 gap-1 px-2.5 text-xs">
          {isWorking ? <IconRefresh className="h-3.5 w-3.5 animate-spin" /> : <IconSparkles className="h-3.5 w-3.5" />}
          <span>{isWorking ? "Generating..." : "Regenerate"}</span>
        </Button>
      </div>
    </div>
  )

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-5">
            <Skeleton className="h-[100px] w-[100px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  // Error state
  if (error && !data) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50">
              <IconAlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
              <Button variant="outline" size="sm" onClick={() => regenerate()} className="h-7 gap-1 text-xs">
                <IconRefresh className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No data — prompt to generate
  if (!data) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10">
            <IconSparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm font-medium">No plan analysis yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Click Regenerate to get AI insights on your financial plan</p>
        </div>
      </div>
    )
  }

  const severity = PLAN_SEVERITY_STYLES[data.allocationReview.severity] || PLAN_SEVERITY_STYLES.positive

  const allocBuckets = [
    { label: "Needs", pct: data.allocationReview.needsPct, target: 50, color: "bg-blue-500", trackColor: "bg-blue-100 dark:bg-blue-900/30", textColor: "text-blue-600 dark:text-blue-400" },
    { label: "Wants", pct: data.allocationReview.wantsPct, target: 30, color: "bg-amber-500", trackColor: "bg-amber-100 dark:bg-amber-900/30", textColor: "text-amber-600 dark:text-amber-400" },
    { label: "Investments", pct: data.allocationReview.investmentsPct, target: 12, color: "bg-indigo-500", trackColor: "bg-indigo-100 dark:bg-indigo-900/30", textColor: "text-indigo-600 dark:text-indigo-400" },
    { label: "Savings", pct: data.allocationReview.savingsPct, target: 8, color: "bg-emerald-500", trackColor: "bg-emerald-100 dark:bg-emerald-900/30", textColor: "text-emerald-600 dark:text-emerald-400" },
  ]

  return (
    <div className="space-y-4">
      {header}

      {isRegenerating && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <IconRefresh className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs font-medium text-primary">Regenerating with latest data...</span>
        </div>
      )}

      {/* 1. Score Ring + Summary */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <PlanScoreRing score={data.planScore} />
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed">{data.summary}</p>
            {generatedAt && (
              <p className="mt-2 text-[11px] text-muted-foreground/60" suppressHydrationWarning>
                Analyzed {new Date(generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Allocation Breakdown */}
      <div className={`rounded-xl border ${severity.border} ${severity.bg} p-5`}>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allocation Breakdown</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {allocBuckets.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{b.label}</span>
                <span className={`text-xs font-medium ${b.textColor}`}>{b.pct.toFixed(0)}%</span>
              </div>
              <div className={`mt-1.5 h-2 w-full overflow-hidden rounded-full ${b.trackColor}`}>
                <div className={`h-full rounded-full ${b.color} transition-all duration-700`} style={{ width: `${Math.min((b.pct / Math.max(b.target, 1)) * 100, 100)}%` }} />
              </div>
              <p className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">target ~{b.target}%</p>
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${severity.text}`}>{data.allocationReview.verdict}</p>
      </div>

      {/* 3. Plan vs Actual */}
      {data.planVsActual.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan vs Actual</h4>
          <div className="space-y-3">
            {data.planVsActual.map((item) => {
              const statusStyle = PLAN_STATUS_STYLES[item.status] || PLAN_STATUS_STYLES.on_track
              const barPct = item.planned > 0 ? (item.actual / item.planned) * 100 : 0
              const barColor = item.status === "over" ? "bg-rose-500" : item.status === "under" ? "bg-blue-500" : "bg-emerald-500"
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatINR(item.actual)} / {formatINR(item.planned)}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle.color} ${statusStyle.bg}`}>
                        {statusStyle.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(barPct, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Goal Feasibility */}
      {data.goalFeasibility.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal Feasibility</h4>
          <div className="space-y-3">
            {data.goalFeasibility.map((goal) => {
              const pctDone = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
              return (
                <div key={goal.goalName} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${goal.feasible ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
                        {goal.feasible
                          ? <IconCircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          : <IconAlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        }
                      </div>
                      <span className="text-sm font-semibold truncate">{goal.goalName}</span>
                    </div>
                    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${goal.feasible ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40" : "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40"}`}>
                      {goal.feasible ? "On track" : "At risk"}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div className={`h-full rounded-full transition-all duration-700 ${goal.feasible ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(pctDone, 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatINR(goal.currentAmount)} of {formatINR(goal.targetAmount)}</span>
                    <span className="tabular-nums">
                      {goal.monthlySaving > 0 ? `${formatINR(goal.monthlySaving)}/mo \u2022 ${goal.monthsToGoal} mo left` : "No monthly saving"}
                    </span>
                  </div>
                  <p className={`mt-1.5 text-xs ${goal.feasible ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {goal.suggestion}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. Recommendations */}
      {data.recommendations.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendations</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.recommendations.map((rec, i) => {
              const impact = PLAN_IMPACT_STYLES[rec.impact] || PLAN_IMPACT_STYLES.low
              return (
                <div key={i} className="relative rounded-xl border bg-card p-4">
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${impact.dot}`} />
                    <span className={`text-[11px] font-medium ${impact.text}`}>{rec.impact}</span>
                  </div>
                  <p className="pr-16 text-sm font-semibold">{rec.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                  <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{rec.category}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 6. Key Takeaway Callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <IconSparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Key Takeaway</p>
            <p className="mt-1 text-sm leading-relaxed">{data.keyTakeaway}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
