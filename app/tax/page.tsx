"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconReceipt2,
  IconScale,
  IconArrowDown,
  IconArrowUp,
  IconCash,
  IconShieldCheck,
  IconHomeDollar,
  IconHeartbeat,
  IconSchool,
  IconPigMoney,
  IconBuildingBank,
  IconCheck,
  IconInfoCircle,
  IconSparkles,
} from "@tabler/icons-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { useAiInsight } from "@/hooks/use-ai-insights"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MetricTile } from "@/components/metric-tile"
import { InfoTooltip } from "@/components/info-tooltip"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { InsightMarkdown } from "@/components/insight-markdown"
import { formatINR, formatCompact, formatCompactAxis } from "@/lib/format"
import { calculateTax, getDefaultTaxConfig, type TaxConfig, type TaxComparison } from "@/lib/tax"
import { stagger, fadeUp, fadeUpSmall, scaleIn } from "@/lib/motion"
import type { TaxTipData } from "@/lib/ai-types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_80C_LIMIT = 150_000
const DEBOUNCE_MS = 800

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  className,
}: {
  id: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value > 0 ? value.toString() : "")
  const ref = useRef<HTMLInputElement>(null)

  // Sync external value changes (e.g. when data loads from API)
  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setDisplay(value > 0 ? value.toString() : "")
    }
  }, [value])

  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
        INR
      </span>
      <Input
        ref={ref}
        id={id}
        type="number"
        min={0}
        step={1000}
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          setDisplay(e.target.value)
          const num = parseFloat(e.target.value) || 0
          onChange(Math.max(0, num))
        }}
        className="pl-11 tabular-nums"
      />
    </div>
  )
}

function FieldRow({
  label,
  id,
  value,
  onChange,
  tooltip,
}: {
  label: string
  id: string
  value: number
  onChange: (v: number) => void
  tooltip?: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <Label htmlFor={id} className="text-sm text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} iconClassName="h-3 w-3" />}
      </Label>
      <CurrencyInput id={id} value={value} onChange={onChange} className="w-40 sm:w-48" />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
      {children}
    </h3>
  )
}

// ---------------------------------------------------------------------------
// SIP auto-detection helper
// ---------------------------------------------------------------------------

interface SIPItem {
  name: string
  type: string
  monthlyAmount: number
  totalInvested: number
  status: string
}

function detectInvestmentDeductions(sips: SIPItem[]): { ppf: number; elss: number } {
  let ppf = 0
  let elss = 0

  for (const sip of sips) {
    if (sip.status !== "active") continue
    const nameUpper = sip.name.toUpperCase()
    const typeUpper = sip.type?.toUpperCase() || ""

    if (typeUpper === "PPF" || nameUpper.includes("PPF") || nameUpper.includes("PUBLIC PROVIDENT")) {
      ppf += sip.monthlyAmount * 12
    } else if (
      typeUpper === "ELSS" ||
      nameUpper.includes("ELSS") ||
      nameUpper.includes("TAX SAVER") ||
      nameUpper.includes("TAX SAVING")
    ) {
      elss += sip.monthlyAmount * 12
    }
  }

  return { ppf, elss }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TaxPlannerPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/")
  }, [authLoading, isAuthenticated, router])

  // ── Data fetching ──

  const { data: taxData, isLoading: configLoading } = useQuery<{ success: boolean; config: TaxConfig }>({
    queryKey: ["tax-config"],
    queryFn: async () => {
      const res = await fetch("/api/tax")
      if (!res.ok) throw new Error("Failed to fetch tax config")
      return res.json()
    },
    enabled: isAuthenticated,
  })

  const { data: sipData } = useQuery<{ success: boolean; items: SIPItem[] }>({
    queryKey: ["sips"],
    queryFn: async () => {
      const res = await fetch("/api/sips")
      if (!res.ok) throw new Error("Failed to fetch SIPs")
      return res.json()
    },
    enabled: isAuthenticated,
  })

  const saveMutation = useMutation({
    mutationFn: async (config: TaxConfig) => {
      const res = await fetch("/api/tax", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error("Failed to save tax config")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-config"] })
    },
  })

  // ── Local state ──

  const [config, setConfig] = useState<TaxConfig>(getDefaultTaxConfig)
  const [initialized, setInitialized] = useState(false)
  const [sipAutoApplied, setSipAutoApplied] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server once loaded
  useEffect(() => {
    if (taxData?.config && !initialized) {
      // Merge with defaults to handle missing fields
      const merged: TaxConfig = {
        ...getDefaultTaxConfig(),
        ...taxData.config,
        otherIncome: { ...getDefaultTaxConfig().otherIncome, ...taxData.config.otherIncome },
        deductions80C: { ...getDefaultTaxConfig().deductions80C, ...taxData.config.deductions80C },
        deductions80D: { ...getDefaultTaxConfig().deductions80D, ...taxData.config.deductions80D },
        hra: { ...getDefaultTaxConfig().hra, ...taxData.config.hra },
      }
      setConfig(merged)
      setInitialized(true)
    }
  }, [taxData, initialized])

  // Auto-detect PPF/ELSS from SIPs (only on first load if those fields are 0)
  useEffect(() => {
    if (!sipData?.items || sipAutoApplied || !initialized) return
    const detected = detectInvestmentDeductions(sipData.items)
    if (detected.ppf > 0 || detected.elss > 0) {
      setConfig((prev) => {
        const needsUpdate =
          (detected.ppf > 0 && prev.deductions80C.ppf === 0) ||
          (detected.elss > 0 && prev.deductions80C.elss === 0)
        if (!needsUpdate) return prev
        return {
          ...prev,
          deductions80C: {
            ...prev.deductions80C,
            ppf: prev.deductions80C.ppf === 0 ? detected.ppf : prev.deductions80C.ppf,
            elss: prev.deductions80C.elss === 0 ? detected.elss : prev.deductions80C.elss,
          },
        }
      })
      toast.info("Auto-detected investments", {
        description: `PPF: ${formatINR(detected.ppf)}, ELSS: ${formatINR(detected.elss)} from your active SIPs`,
      })
    }
    setSipAutoApplied(true)
  }, [sipData, sipAutoApplied, initialized])

  // Debounced auto-save
  const scheduleAutoSave = useCallback(
    (newConfig: TaxConfig) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate(newConfig)
      }, DEBOUNCE_MS)
    },
    [saveMutation]
  )

  // Updater helper
  const update = useCallback(
    (fn: (prev: TaxConfig) => TaxConfig) => {
      setConfig((prev) => {
        const next = fn(prev)
        scheduleAutoSave(next)
        return next
      })
    },
    [scheduleAutoSave]
  )

  // ── AI tax insight ──
  const taxInsight = useAiInsight("tax_optimization")

  // ── Tax calculation (reactive) ──

  const comparison: TaxComparison = useMemo(() => calculateTax(config), [config])
  const oldTax = comparison.old
  const newTax = comparison.new
  const recommended = comparison.recommended
  const savings = comparison.savings

  // ── 80C utilization ──

  const total80C =
    config.deductions80C.ppf +
    config.deductions80C.elss +
    config.deductions80C.lic +
    config.deductions80C.epf +
    config.deductions80C.tuitionFees +
    config.deductions80C.homeLoanPrincipal +
    config.deductions80C.nsc +
    config.deductions80C.others
  const utilized80C = Math.min(total80C, SECTION_80C_LIMIT)
  const utilization80CPct = Math.min((total80C / SECTION_80C_LIMIT) * 100, 100)

  // ── Chart data ──

  const chartData = [
    { regime: "Old Regime", tax: oldTax.totalTax, fill: "var(--chart-1)" },
    { regime: "New Regime", tax: newTax.totalTax, fill: "var(--chart-2)" },
  ]

  // ── Shell wrapper (sidebar + header) ──

  const shell = (children: React.ReactNode) => (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader
          title="Tax Planner"
          subtitle="Indian Income Tax FY 2025-26"
          actions={
            <div className="flex items-center gap-2">
              {saveMutation.isPending && (
                <Badge variant="outline" className="text-[11px] animate-pulse">
                  Saving...
                </Badge>
              )}
              <Select
                value={config.preferredRegime}
                onValueChange={(v) =>
                  update((p) => ({ ...p, preferredRegime: v as TaxConfig["preferredRegime"] }))
                }
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Best)</SelectItem>
                  <SelectItem value="old">Old Regime</SelectItem>
                  <SelectItem value="new">New Regime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )

  // ── Loading state ──

  if (authLoading || configLoading) {
    return shell(
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-5 p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return shell(
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* ── Metric Tiles ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <motion.div variants={fadeUpSmall}>
              <MetricTile
                label="Gross Income"
                value={formatINR(oldTax.grossTotalIncome)}
                trendLabel={`~${formatCompact(Math.round(oldTax.grossTotalIncome / 12))}/mo`}
                icon={<IconCash className="h-5 w-5" />}
                tooltip="Salary + Other Income"
              />
            </motion.div>
            <motion.div variants={fadeUpSmall}>
              <MetricTile
                label="Old Regime Tax"
                value={formatINR(oldTax.totalTax)}
                trendLabel={`Effective ${oldTax.effectiveRate.toFixed(1)}%`}
                icon={<IconReceipt2 className="h-5 w-5" />}
                tone={recommended === "old" ? "positive" : "neutral"}
                tooltip="Tax under Old Regime with all deductions"
              />
            </motion.div>
            <motion.div variants={fadeUpSmall}>
              <MetricTile
                label="New Regime Tax"
                value={formatINR(newTax.totalTax)}
                trendLabel={`Effective ${newTax.effectiveRate.toFixed(1)}%`}
                icon={<IconScale className="h-5 w-5" />}
                tone={recommended === "new" ? "positive" : "neutral"}
                tooltip="Tax under New Regime (only standard deduction)"
              />
            </motion.div>
            <motion.div variants={fadeUpSmall}>
              <MetricTile
                label="You Save"
                value={formatINR(savings)}
                trendLabel={`with ${recommended === "old" ? "Old" : "New"} Regime`}
                icon={<IconPigMoney className="h-5 w-5" />}
                tone="positive"
                tooltip="Difference between the two regimes"
              />
            </motion.div>
          </motion.div>

          {/* ── AI Tax Savings ── */}
          <motion.div variants={fadeUp}>
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <IconSparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">AI Tax Saving Tips</CardTitle>
                      <CardDescription className="text-xs">Personalized recommendations based on your tax profile</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => taxInsight.regenerate()} disabled={taxInsight.isLoading || taxInsight.isRegenerating}>
                    {taxInsight.isLoading || taxInsight.isRegenerating ? "Analyzing..." : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {taxInsight.isLoading || taxInsight.isRegenerating ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : taxInsight.structuredData ? (
                  (() => {
                    const taxData = taxInsight.structuredData as unknown as TaxTipData
                    return (
                      <div className="space-y-4">
                        {/* Hero banner */}
                        <div className="relative rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                          <div>
                            <p className="text-2xl font-bold text-primary tabular-nums">
                              {formatINR(taxData.totalSavingPotential)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Total Tax Saving Potential
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="absolute top-3 right-3 text-[11px] bg-background/80 backdrop-blur-sm"
                          >
                            {taxData.regime.recommended === "new" ? "New" : "Old"} Regime Recommended
                          </Badge>
                        </div>

                        {/* Deduction Utilization Progress Bars */}
                        {taxData.deductionUtilization && taxData.deductionUtilization.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Deduction Utilization</p>
                            <div className="grid grid-cols-2 gap-3">
                              {taxData.deductionUtilization.map((item) => {
                                const pct = item.limit > 0 ? (item.used / item.limit) * 100 : 0
                                const barColor =
                                  pct > 75
                                    ? "[&>div]:bg-emerald-500"
                                    : pct >= 25
                                      ? "[&>div]:bg-amber-500"
                                      : ""
                                return (
                                  <div key={item.section} className="space-y-1">
                                    <p className="text-xs font-medium truncate">{item.label}</p>
                                    <Progress value={Math.min(pct, 100)} className={`h-1.5 ${barColor}`} />
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                      {formatINR(item.used)} of {formatINR(item.limit)}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tips Cards */}
                        {taxData.tips && taxData.tips.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Recommendations</p>
                            <div className="space-y-2">
                              {taxData.tips.map((tip, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 flex items-start justify-between gap-3"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span
                                        className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                                          tip.priority === "high"
                                            ? "bg-red-500"
                                            : tip.priority === "medium"
                                              ? "bg-amber-500"
                                              : "bg-emerald-500"
                                        }`}
                                      />
                                      <p className="text-xs font-semibold truncate">{tip.title}</p>
                                      {tip.section && (
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 flex-shrink-0">
                                          {tip.section}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      {tip.description}
                                    </p>
                                  </div>
                                  {tip.savingAmount > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap flex-shrink-0 tabular-nums">
                                      {formatINR(tip.savingAmount)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Subscriptions */}
                        {taxData.subscriptions && taxData.subscriptions.length > 0 && (() => {
                          const totalMonthly = taxData.subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0)
                          const totalAnnual = taxData.subscriptions.reduce((s, sub) => s + sub.annualCost, 0)
                          return (
                            <div>
                              {/* Section header with totals */}
                              <div className="flex items-end justify-between mb-3">
                                <p className="text-xs font-semibold text-muted-foreground">Subscriptions</p>
                                <div className="text-right">
                                  <p className="text-sm font-bold tabular-nums">{formatINR(totalMonthly)}<span className="text-[11px] font-normal text-muted-foreground">/mo</span></p>
                                  <p className="text-[11px] text-muted-foreground tabular-nums">{formatINR(totalAnnual)}/yr</p>
                                </div>
                              </div>

                              {/* Subscription cards */}
                              <div className="space-y-2">
                                {taxData.subscriptions.map((sub, i) => (
                                  <div
                                    key={i}
                                    className="group rounded-xl border border-border/40 bg-card/60 p-3 flex items-center gap-3 transition-colors hover:bg-card"
                                  >
                                    {/* Logo */}
                                    <div className="flex-shrink-0 h-10 w-10 relative">
                                      <img
                                        src={`https://img.logo.dev/${sub.domain}?token=pk_a1V5q9A4TiOUjCQbz9ZXhQ&size=128&format=png`}
                                        alt={sub.name}
                                        className="h-10 w-10 rounded-xl object-contain bg-white p-0.5 shadow-sm ring-1 ring-border/20"
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none"
                                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                          if (fallback) fallback.style.display = "flex"
                                        }}
                                      />
                                      <div
                                        className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center text-sm font-bold text-primary absolute inset-0"
                                        style={{ display: "none" }}
                                      >
                                        {sub.name.charAt(0).toUpperCase()}
                                      </div>
                                    </div>

                                    {/* Name + suggestion */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-semibold truncate">{sub.name}</p>
                                        <span className="text-[9px] text-muted-foreground/60 hidden sm:inline">{sub.domain}</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">{sub.suggestion}</p>
                                    </div>

                                    {/* Cost pill */}
                                    <div className="flex-shrink-0 text-right">
                                      <p className="text-sm font-bold tabular-nums">{formatINR(sub.monthlyCost)}</p>
                                      <p className="text-[11px] text-muted-foreground tabular-nums">{formatINR(sub.annualCost)}/yr</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })()
                ) : taxInsight.sections && taxInsight.sections.length > 0 ? (
                  <div className="space-y-3">
                    {taxInsight.sections.map((section) => (
                      <div key={section.id}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{section.title}</p>
                        {section.type === "summary" && section.text && (
                          <p className="text-sm text-foreground">{section.text}</p>
                        )}
                        {(section.type === "list" || section.type === "numbered_list") && section.items && (
                          <ul className={`text-sm space-y-1 ${section.type === "numbered_list" ? "list-decimal" : "list-disc"} list-inside text-muted-foreground`}>
                            {section.items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        )}
                        {section.type === "highlight" && section.highlight && (
                          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${
                            section.severity === "positive" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                            section.severity === "warning" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                            "bg-muted text-foreground"
                          }`}>
                            {section.highlight}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : taxInsight.content ? (
                  <InsightMarkdown content={taxInsight.content} />
                ) : (
                  <p className="text-sm text-muted-foreground">Enter your income details above to get personalized tax-saving recommendations.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Main Content ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ── LEFT: Inputs (2 cols on xl) ── */}
            <div className="xl:col-span-2 space-y-6">
              <Tabs defaultValue="income" className="w-full">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="income" className="text-xs">Income</TabsTrigger>
                  <TabsTrigger value="80c" className="text-xs">80C</TabsTrigger>
                  <TabsTrigger value="health" className="text-xs">Health & HRA</TabsTrigger>
                  <TabsTrigger value="other" className="text-xs">Other</TabsTrigger>
                </TabsList>

                {/* ── Income Tab ── */}
                <TabsContent value="income">
                  <motion.div variants={fadeUp} initial="hidden" animate="show">
                    <Card className="card-elevated">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <IconCash className="h-4 w-4 text-primary" />
                          Income Details
                        </CardTitle>
                        <CardDescription>
                          Enter your gross annual salary and other income sources
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div>
                          <Label htmlFor="gross-income" className="text-sm font-medium">
                            Gross Annual Salary (CTC)
                          </Label>
                          <CurrencyInput
                            id="gross-income"
                            value={config.grossAnnualIncome}
                            onChange={(v) => update((p) => ({ ...p, grossAnnualIncome: v }))}
                            className="mt-1.5 max-w-xs"
                          />
                        </div>

                        <Separator />

                        <SectionLabel>Other Income</SectionLabel>
                        <div className="space-y-3">
                          <FieldRow
                            label="FD Interest"
                            id="fd-interest"
                            value={config.otherIncome.fdInterest}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                otherIncome: { ...p.otherIncome, fdInterest: v },
                              }))
                            }
                            tooltip="Interest earned from Fixed Deposits"
                          />
                          <FieldRow
                            label="STCG (Short-term)"
                            id="stcg"
                            value={config.otherIncome.capitalGainsSTCG}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                otherIncome: { ...p.otherIncome, capitalGainsSTCG: v },
                              }))
                            }
                            tooltip="Short-term capital gains from stocks/MF sold within 1 year"
                          />
                          <FieldRow
                            label="LTCG (Long-term)"
                            id="ltcg"
                            value={config.otherIncome.capitalGainsLTCG}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                otherIncome: { ...p.otherIncome, capitalGainsLTCG: v },
                              }))
                            }
                            tooltip="Long-term capital gains (equity >1yr exemption under sec 112A up to 1.25L)"
                          />
                          <FieldRow
                            label="Rental Income"
                            id="rental-income"
                            value={config.otherIncome.rentalIncome}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                otherIncome: { ...p.otherIncome, rentalIncome: v },
                              }))
                            }
                            tooltip="Net annual rental income after 30% standard deduction"
                          />
                          <FieldRow
                            label="Other Sources"
                            id="other-sources"
                            value={config.otherIncome.otherSources}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                otherIncome: { ...p.otherIncome, otherSources: v },
                              }))
                            }
                            tooltip="Any other taxable income (freelance, gifts, etc.)"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* ── 80C Tab ── */}
                <TabsContent value="80c">
                  <motion.div variants={fadeUp} initial="hidden" animate="show">
                    <Card className="card-elevated">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <IconShieldCheck className="h-4 w-4 text-primary" />
                          Section 80C Deductions
                        </CardTitle>
                        <CardDescription>
                          Maximum limit: {formatINR(SECTION_80C_LIMIT)} (Old Regime only)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {/* Utilization meter */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Used {formatINR(utilized80C)} of {formatINR(SECTION_80C_LIMIT)}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                utilization80CPct >= 100
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                  : utilization80CPct >= 70
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                    : "bg-slate-500/10 text-slate-700 dark:text-slate-400"
                              }
                            >
                              {utilization80CPct.toFixed(0)}%
                            </Badge>
                          </div>
                          <Progress
                            value={utilization80CPct}
                            className={`h-2 ${
                              utilization80CPct >= 100
                                ? "[&>div]:bg-emerald-500"
                                : utilization80CPct >= 70
                                  ? "[&>div]:bg-amber-500"
                                  : ""
                            }`}
                          />
                          {total80C > SECTION_80C_LIMIT && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              Excess {formatINR(total80C - SECTION_80C_LIMIT)} over the 1.5L cap will not be deducted
                            </p>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <FieldRow
                            label="PPF"
                            id="ppf"
                            value={config.deductions80C.ppf}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, ppf: v },
                              }))
                            }
                            tooltip="Public Provident Fund contributions"
                          />
                          <FieldRow
                            label="ELSS (Tax Saver MF)"
                            id="elss"
                            value={config.deductions80C.elss}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, elss: v },
                              }))
                            }
                            tooltip="Equity-Linked Savings Scheme mutual fund"
                          />
                          <FieldRow
                            label="LIC Premium"
                            id="lic"
                            value={config.deductions80C.lic}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, lic: v },
                              }))
                            }
                            tooltip="Life Insurance Corporation premium paid"
                          />
                          <FieldRow
                            label="EPF (Employee)"
                            id="epf"
                            value={config.deductions80C.epf}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, epf: v },
                              }))
                            }
                            tooltip="Employee's share of Provident Fund contribution"
                          />
                          <FieldRow
                            label="Tuition Fees"
                            id="tuition"
                            value={config.deductions80C.tuitionFees}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, tuitionFees: v },
                              }))
                            }
                            tooltip="School/college tuition fees for up to 2 children"
                          />
                          <FieldRow
                            label="Home Loan Principal"
                            id="homeloan-principal"
                            value={config.deductions80C.homeLoanPrincipal}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, homeLoanPrincipal: v },
                              }))
                            }
                            tooltip="Principal repayment of home loan"
                          />
                          <FieldRow
                            label="NSC"
                            id="nsc"
                            value={config.deductions80C.nsc}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, nsc: v },
                              }))
                            }
                            tooltip="National Savings Certificate"
                          />
                          <FieldRow
                            label="Others (SCSS, Sukanya, etc.)"
                            id="80c-others"
                            value={config.deductions80C.others}
                            onChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80C: { ...p.deductions80C, others: v },
                              }))
                            }
                            tooltip="Other 80C-eligible investments: SCSS, Sukanya Samriddhi, 5yr FD, etc."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* ── Health & HRA Tab ── */}
                <TabsContent value="health">
                  <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-6">
                    {/* 80D */}
                    <Card className="card-elevated">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <IconHeartbeat className="h-4 w-4 text-primary" />
                          Section 80D - Health Insurance
                        </CardTitle>
                        <CardDescription>
                          Self: max 25K | Parents: max 25K (50K if senior citizen)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FieldRow
                          label="Self & Family Premium"
                          id="self-health"
                          value={config.deductions80D.selfHealthInsurance}
                          onChange={(v) =>
                            update((p) => ({
                              ...p,
                              deductions80D: { ...p.deductions80D, selfHealthInsurance: v },
                            }))
                          }
                          tooltip="Health insurance premium for self, spouse & children (max 25K)"
                        />
                        <FieldRow
                          label="Parents Premium"
                          id="parents-health"
                          value={config.deductions80D.parentsHealthInsurance}
                          onChange={(v) =>
                            update((p) => ({
                              ...p,
                              deductions80D: { ...p.deductions80D, parentsHealthInsurance: v },
                            }))
                          }
                          tooltip="Health insurance premium for parents"
                        />
                        <div className="flex items-center gap-3">
                          <Switch
                            id="parents-senior"
                            checked={config.deductions80D.parentsAreSenior}
                            onCheckedChange={(v) =>
                              update((p) => ({
                                ...p,
                                deductions80D: { ...p.deductions80D, parentsAreSenior: v },
                              }))
                            }
                          />
                          <Label htmlFor="parents-senior" className="text-sm text-muted-foreground cursor-pointer">
                            Parents are senior citizens (60+)
                            <InfoTooltip
                              text="Senior citizens can claim up to Rs.50,000 instead of Rs.25,000"
                              iconClassName="h-3 w-3 ml-1"
                            />
                          </Label>
                        </div>
                      </CardContent>
                    </Card>

                    {/* HRA */}
                    <Card className="card-elevated">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <IconHomeDollar className="h-4 w-4 text-primary" />
                          HRA Exemption
                        </CardTitle>
                        <CardDescription>
                          Applicable only under Old Regime for salaried individuals paying rent
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FieldRow
                          label="Basic Salary (annual)"
                          id="basic-salary"
                          value={config.hra.basicSalary}
                          onChange={(v) =>
                            update((p) => ({ ...p, hra: { ...p.hra, basicSalary: v } }))
                          }
                          tooltip="Basic salary component from your salary slip (usually 40-50% of CTC)"
                        />
                        <FieldRow
                          label="HRA Received (annual)"
                          id="hra-received"
                          value={config.hra.hraReceived}
                          onChange={(v) =>
                            update((p) => ({ ...p, hra: { ...p.hra, hraReceived: v } }))
                          }
                          tooltip="Total HRA received from employer in the year"
                        />
                        <FieldRow
                          label="Rent Paid (annual)"
                          id="rent-paid"
                          value={config.hra.rentPaid}
                          onChange={(v) =>
                            update((p) => ({ ...p, hra: { ...p.hra, rentPaid: v } }))
                          }
                          tooltip="Total rent paid during the year"
                        />
                        <div className="flex items-center gap-3">
                          <Switch
                            id="metro-city"
                            checked={config.hra.isMetroCity}
                            onCheckedChange={(v) =>
                              update((p) => ({ ...p, hra: { ...p.hra, isMetroCity: v } }))
                            }
                          />
                          <Label htmlFor="metro-city" className="text-sm text-muted-foreground cursor-pointer">
                            Metro city (Delhi, Mumbai, Chennai, Kolkata)
                            <InfoTooltip
                              text="Metro cities get 50% of basic salary for HRA calc, non-metro gets 40%"
                              iconClassName="h-3 w-3 ml-1"
                            />
                          </Label>
                        </div>
                        {oldTax.hraExemption > 0 && (
                          <div className="rounded-lg bg-emerald-500/5 border border-emerald-200 dark:border-emerald-900 p-3">
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              HRA Exemption: {formatINR(oldTax.hraExemption)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Minimum of: HRA received, Rent - 10% Basic, {config.hra.isMetroCity ? "50%" : "40%"} of Basic
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* ── Other Deductions Tab ── */}
                <TabsContent value="other">
                  <motion.div variants={fadeUp} initial="hidden" animate="show">
                    <Card className="card-elevated">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <IconBuildingBank className="h-4 w-4 text-primary" />
                          Other Deductions
                        </CardTitle>
                        <CardDescription>
                          Additional deductions under Old Regime
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FieldRow
                          label="80TTA - Savings Interest"
                          id="80tta"
                          value={config.section80TTA}
                          onChange={(v) => update((p) => ({ ...p, section80TTA: v }))}
                          tooltip="Interest on savings account, max Rs.10,000"
                        />
                        <FieldRow
                          label="Section 24 - Home Loan Interest"
                          id="sec24"
                          value={config.section24HomeLoan}
                          onChange={(v) => update((p) => ({ ...p, section24HomeLoan: v }))}
                          tooltip="Home loan interest deduction, max Rs.2,00,000 for self-occupied"
                        />
                        <FieldRow
                          label="80E - Education Loan Interest"
                          id="80e"
                          value={config.section80E}
                          onChange={(v) => update((p) => ({ ...p, section80E: v }))}
                          tooltip="Interest on education loan (no upper limit), available for 8 years"
                        />
                        <FieldRow
                          label="80CCD(1B) - NPS"
                          id="80ccd"
                          value={config.section80CCD1B}
                          onChange={(v) => update((p) => ({ ...p, section80CCD1B: v }))}
                          tooltip="Additional NPS contribution (over 80C), max Rs.50,000"
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── RIGHT: Tax Comparison (1 col on xl) ── */}
            <div className="space-y-6">
              {/* Recommendation badge */}
              <motion.div variants={scaleIn} initial="hidden" animate="show">
                <Card className="card-elevated border-primary/30 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <IconCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-primary">
                        {recommended === "old" ? "Old" : "New"} Regime Recommended
                      </p>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {formatINR(savings)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      less tax compared to {recommended === "old" ? "New" : "Old"} Regime
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Bar chart comparison */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <Card className="card-elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tax Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} layout="vertical" barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                        <XAxis
                          type="number"
                          tickFormatter={(v: number) => formatCompactAxis(v)}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="regime"
                          width={90}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          formatter={(v: number) => [formatINR(v), "Total Tax"]}
                          contentStyle={{
                            background: "var(--card)",
                            color: "var(--card-foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="tax" radius={[0, 6, 6, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Side-by-side breakdown */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <Card className="card-elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Detailed Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 pb-2 mb-1 border-b border-border/50">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Item</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 w-24 text-right">Old</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 w-24 text-right">New</span>
                    </div>
                    <ComparisonRow label="Gross Income" old={oldTax.grossTotalIncome} new_={newTax.grossTotalIncome} />
                    <ComparisonRow label="Standard Deduction" old={oldTax.standardDeduction} new_={newTax.standardDeduction} />
                    {oldTax.hraExemption > 0 && (
                      <ComparisonRow label="HRA Exemption" old={oldTax.hraExemption} new_={0} />
                    )}
                    <ComparisonRow label="80C Deductions" old={oldTax.capped80C} new_={0} />
                    {oldTax.total80D > 0 && (
                      <ComparisonRow label="80D (Health)" old={oldTax.total80D} new_={0} />
                    )}
                    {(oldTax.section80TTA + oldTax.section24 + oldTax.section80E + oldTax.section80CCD1B) > 0 && (
                      <ComparisonRow
                        label="Other Deductions"
                        old={oldTax.section80TTA + oldTax.section24 + oldTax.section80E + oldTax.section80CCD1B}
                        new_={0}
                      />
                    )}
                    <Separator className="my-1" />
                    <ComparisonRow label="Total Deductions" old={oldTax.totalDeductions} new_={newTax.totalDeductions} bold />
                    <ComparisonRow label="Taxable Income" old={oldTax.taxableIncome} new_={newTax.taxableIncome} bold />
                    <Separator className="my-1" />
                    <ComparisonRow label="Tax (before rebate)" old={oldTax.taxBeforeRebate} new_={newTax.taxBeforeRebate} />
                    {(oldTax.rebate87A > 0 || newTax.rebate87A > 0) && (
                      <ComparisonRow label="87A Rebate" old={-oldTax.rebate87A} new_={-newTax.rebate87A} />
                    )}
                    {(oldTax.surcharge > 0 || newTax.surcharge > 0) && (
                      <ComparisonRow label="Surcharge" old={oldTax.surcharge} new_={newTax.surcharge} />
                    )}
                    <ComparisonRow label="Cess (4%)" old={oldTax.cess} new_={newTax.cess} />
                    <Separator className="my-1" />
                    <ComparisonRow label="Total Tax" old={oldTax.totalTax} new_={newTax.totalTax} bold highlight />
                    <ComparisonRow
                      label="Effective Rate"
                      oldStr={`${oldTax.effectiveRate.toFixed(1)}%`}
                      newStr={`${newTax.effectiveRate.toFixed(1)}%`}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Slab-wise breakdown */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <Card className="card-elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Slab-wise Tax</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="old-slabs">
                      <TabsList className="w-full grid grid-cols-2 mb-3">
                        <TabsTrigger value="old-slabs" className="text-xs">Old Regime</TabsTrigger>
                        <TabsTrigger value="new-slabs" className="text-xs">New Regime</TabsTrigger>
                      </TabsList>
                      <TabsContent value="old-slabs">
                        <div className="space-y-1.5">
                          {oldTax.slabBreakdown.map((s, i) => (
                            <SlabRow key={i} slab={s.slab} rate={s.rate} tax={s.tax} />
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="new-slabs">
                        <div className="space-y-1.5">
                          {newTax.slabBreakdown.map((s, i) => (
                            <SlabRow key={i} slab={s.slab} rate={s.rate} tax={s.tax} />
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
      </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ComparisonRow({
  label,
  old,
  new_,
  oldStr,
  newStr,
  bold,
  highlight,
}: {
  label: string
  old?: number
  new_?: number
  oldStr?: string
  newStr?: string
  bold?: boolean
  highlight?: boolean
}) {
  const oldDisplay = oldStr ?? (old !== undefined ? formatINR(old) : "-")
  const newDisplay = newStr ?? (new_ !== undefined ? formatINR(new_) : "-")
  const rowFont = bold ? "font-semibold" : "font-normal"

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 text-xs ${rowFont} ${
        highlight ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-right tabular-nums w-24">{oldDisplay}</span>
      <span className="text-right tabular-nums w-24">{newDisplay}</span>
    </div>
  )
}

function SlabRow({ slab, rate, tax }: { slab: string; rate: string; tax: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{slab}</span>
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-[11px] px-1.5 py-0">
          {rate}
        </Badge>
        <span className="tabular-nums w-20 text-right font-medium">
          {formatINR(tax)}
        </span>
      </div>
    </div>
  )
}
