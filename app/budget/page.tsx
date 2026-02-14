"use client"

import * as React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  IconAlertTriangle,
  IconCheck,
  IconEdit,
  IconPigMoney,
  IconPlus,
  IconReceipt2,
  IconTarget,
  IconTrash,
  IconTrendingDown,
  IconX,
} from "@tabler/icons-react"

import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import { calculateCategoryBreakdown } from "@/lib/analytics"
import {
  getCurrentMonth,
  getMonthTransactions,
  isPartialMonth,
} from "@/lib/monthly-utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { MetricTile } from "@/components/metric-tile"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  calculateAllBudgetSpending,
  type BudgetPeriod,
  type BudgetSpending,
} from "@/lib/budget-utils"
import { DEFAULT_BUDGETS } from "@/lib/budget-mapping"
// Shape returned by /api/budget-categories
interface BudgetCategoryItem {
  id: string
  name: string
  transactionCategories: string[]
  description: string
  budgetAmount: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function BudgetPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { transactions, isLoading: transactionsLoading } = useTransactions()

  const [budgets, setBudgets] = useState<Record<string, number>>(DEFAULT_BUDGETS)
  const [categories, setCategories] = useState<BudgetCategoryItem[]>([])
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod | null>(null)
  const [budgetSpending, setBudgetSpending] = useState<BudgetSpending[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [budgetUpdatedAt, setBudgetUpdatedAt] = useState<string | null>(null)

  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  // NWI state
  const [nwiConfig, setNwiConfig] = useState<{
    needs: { percentage: number; categories: string[] }
    wants: { percentage: number; categories: string[] }
    investments: { percentage: number; categories: string[] }
  } | null>(null)
  const [nwiDraft, setNwiDraft] = useState<{ needs: number; wants: number; investments: number }>({ needs: 50, wants: 30, investments: 20 })
  const [nwiSaving, setNwiSaving] = useState(false)

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<BudgetCategoryItem | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryAmount, setNewCategoryAmount] = useState("")
  const [newCategoryDesc, setNewCategoryDesc] = useState("")
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

  const LOCAL_BUDGETS_KEY = "finance:budgets"
  const hasLocalEditsRef = useRef(false)

  type StoredBudgets = {
    budgets: Record<string, unknown>
    updatedAt?: string | null
  }

  const normalizeBudgets = useCallback((raw: Record<string, unknown>, validKeys?: string[]) => {
    const keys = validKeys || Object.keys(DEFAULT_BUDGETS)
    const normalized: Record<string, number> = {}
    for (const key of keys) {
      const val = raw[key]
      const numeric = typeof val === "number" ? val : Number(val)
      normalized[key] = !Number.isNaN(numeric) && numeric >= 0 ? numeric : 0
    }
    return normalized
  }, [])

  // Fetch budget categories from API
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/budget-categories")
      if (!res.ok) return
      const data = await res.json()
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories)
        // Derive budgets from categories
        const derived: Record<string, number> = {}
        for (const cat of data.categories as BudgetCategoryItem[]) {
          derived[cat.name] = cat.budgetAmount
        }
        setBudgets(derived)
      }
    } catch (err) {
      console.error("Failed to load budget categories:", err)
    }
  }, [])

  const loadBudgets = useCallback(async () => {
    let localUpdatedAt: string | null = null
    let hasLocalBudgets = false
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCAL_BUDGETS_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as StoredBudgets | Record<string, unknown>
          const storedBudgets = "budgets" in parsed ? (parsed as StoredBudgets).budgets : parsed
          const storedUpdatedAt = "updatedAt" in parsed ? (parsed as StoredBudgets).updatedAt : null
          const normalized = normalizeBudgets(storedBudgets as Record<string, unknown>)
          setBudgets(normalized)
          setBudgetUpdatedAt(storedUpdatedAt || null)
          localUpdatedAt = storedUpdatedAt || null
          hasLocalBudgets = true
        } catch {
          // ignore
        }
      }
    }
    try {
      const response = await fetch("/api/budgets")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.budgets) {
          if (hasLocalEditsRef.current) return
          if (hasLocalBudgets && !localUpdatedAt) return
          const normalized = normalizeBudgets(data.budgets)
          const remoteUpdatedAt = data.updatedAt || null
          const localDate = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
          const remoteDate = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0
          const normalizedLocalDate = Number.isFinite(localDate) ? localDate : 0
          const normalizedRemoteDate = Number.isFinite(remoteDate) ? remoteDate : 0
          if (!localUpdatedAt || normalizedRemoteDate > normalizedLocalDate) {
            setBudgets(normalized)
            setBudgetUpdatedAt(remoteUpdatedAt)
            if (typeof window !== "undefined") {
              localStorage.setItem(
                LOCAL_BUDGETS_KEY,
                JSON.stringify({ budgets: normalized, updatedAt: remoteUpdatedAt })
              )
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to load budgets:", error)
    }
  }, [normalizeBudgets])

  const loadNwiConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/nwi-config")
      const data = await res.json()
      if (data.success && data.config) {
        setNwiConfig(data.config)
        setNwiDraft({
          needs: data.config.needs.percentage,
          wants: data.config.wants.percentage,
          investments: data.config.investments.percentage,
        })
      }
    } catch {}
  }, [])

  const saveNwiPercentages = async () => {
    if (nwiDraft.needs + nwiDraft.wants + nwiDraft.investments !== 100) return
    setNwiSaving(true)
    try {
      const res = await fetch("/api/nwi-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needs: { percentage: nwiDraft.needs },
          wants: { percentage: nwiDraft.wants },
          investments: { percentage: nwiDraft.investments },
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadNwiConfig()
        setSaveMessage("NWI updated")
        setTimeout(() => setSaveMessage(null), 2000)
      }
    } catch {} finally {
      setNwiSaving(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories()
      loadBudgets()
      loadNwiConfig()
    }
  }, [isAuthenticated, loadCategories, loadBudgets, loadNwiConfig])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    const { year, month } = getCurrentMonth()
    const monthTransactions = getMonthTransactions(transactions, year, month)
    const isPartial = transactions.length > 0 ? isPartialMonth(transactions, year, month) : false
    const today = new Date()
    const daysInMonth = new Date(year, month, 0).getDate()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    const periodDays = isCurrentMonth ? today.getDate() : daysInMonth
    const isPartialPeriod = isCurrentMonth ? periodDays < daysInMonth : isPartial

    const period: BudgetPeriod = {
      startDate: new Date(year, month - 1, 1),
      endDate: isCurrentMonth ? today : new Date(year, month, 0),
      totalDays: daysInMonth,
      elapsedDays: periodDays,
      remainingDays: daysInMonth - periodDays,
      isPartialMonth: isPartialPeriod,
      periodLabel: isPartialPeriod
        ? `${getCurrentMonth().label} (${periodDays} of ${daysInMonth} days)`
        : getCurrentMonth().label,
    }

    setBudgetPeriod(period)
    const categoryBreakdown = calculateCategoryBreakdown(monthTransactions)
    const spending = calculateAllBudgetSpending(budgets, categoryBreakdown, period)
    setBudgetSpending(spending)
  }, [transactions, budgets])

  const saveBudgets = async (newBudgets: Record<string, number>) => {
    setIsSaving(true)
    setSaveMessage(null)
    hasLocalEditsRef.current = true
    setBudgets(newBudgets)
    const updatedAt = new Date().toISOString()
    setBudgetUpdatedAt(updatedAt)
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets: newBudgets }),
      })
      if (!response.ok) throw new Error("Failed to save budgets")
      const data = await response.json()
      if (data.success) {
        const normalized = normalizeBudgets(data.budgets)
        setBudgets(normalized)
        setBudgetUpdatedAt(data.updatedAt || updatedAt)
        if (typeof window !== "undefined") {
          localStorage.setItem(
            LOCAL_BUDGETS_KEY,
            JSON.stringify({ budgets: normalized, updatedAt: data.updatedAt || updatedAt })
          )
        }
        hasLocalEditsRef.current = false
        setSaveMessage("Saved")
      }
    } catch {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify({ budgets: newBudgets, updatedAt }))
      }
      setSaveMessage("Saved locally")
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 2000)
    }
  }

  // ---- CRUD handlers ----

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      setDialogError("Name is required")
      return
    }
    const amount = parseFloat(newCategoryAmount) || 0
    if (amount < 0) {
      setDialogError("Amount must be >= 0")
      return
    }
    setDialogLoading(true)
    setDialogError(null)
    try {
      const res = await fetch("/api/budget-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          budgetAmount: amount,
          description: newCategoryDesc.trim(),
          transactionCategories: [],
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setDialogError(data.error || "Failed to create category")
        return
      }
      // Refresh
      await loadCategories()
      setShowAddDialog(false)
      resetDialogState()
      setSaveMessage("Category added")
      setTimeout(() => setSaveMessage(null), 2000)
    } catch {
      setDialogError("Network error")
    } finally {
      setDialogLoading(false)
    }
  }

  const handleRenameCategory = async () => {
    if (!dialogTarget) return
    const name = newCategoryName.trim()
    if (!name) {
      setDialogError("Name is required")
      return
    }
    setDialogLoading(true)
    setDialogError(null)
    try {
      const res = await fetch("/api/budget-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dialogTarget.id, name }),
      })
      const data = await res.json()
      if (!data.success) {
        setDialogError(data.error || "Failed to rename")
        return
      }
      await loadCategories()
      setShowRenameDialog(false)
      resetDialogState()
      setSaveMessage("Category renamed")
      setTimeout(() => setSaveMessage(null), 2000)
    } catch {
      setDialogError("Network error")
    } finally {
      setDialogLoading(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!dialogTarget) return
    setDialogLoading(true)
    setDialogError(null)
    try {
      const res = await fetch(`/api/budget-categories?id=${dialogTarget.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!data.success) {
        setDialogError(data.error || "Failed to delete")
        return
      }
      await loadCategories()
      setShowDeleteDialog(false)
      resetDialogState()
      setSaveMessage("Category deleted")
      setTimeout(() => setSaveMessage(null), 2000)
    } catch {
      setDialogError("Network error")
    } finally {
      setDialogLoading(false)
    }
  }

  const resetDialogState = () => {
    setDialogTarget(null)
    setNewCategoryName("")
    setNewCategoryAmount("")
    setNewCategoryDesc("")
    setDialogError(null)
    setDialogLoading(false)
  }

  const openRenameDialog = (cat: BudgetCategoryItem) => {
    setDialogTarget(cat)
    setNewCategoryName(cat.name)
    setDialogError(null)
    setShowRenameDialog(true)
  }

  const openDeleteDialog = (cat: BudgetCategoryItem) => {
    setDialogTarget(cat)
    setDialogError(null)
    setShowDeleteDialog(true)
  }

  // ---- end CRUD handlers ----

  const totalMonthlyBudget = Object.values(budgets).reduce((sum, b) => sum + b, 0)
  const totalProratedBudget = budgetSpending.reduce((sum, b) => sum + b.proratedBudget, 0)
  const totalSpent = budgetSpending.reduce((sum, b) => sum + b.actualSpent, 0)
  const totalProjected = budgetSpending.reduce((sum, b) => sum + b.projectedSpent, 0)
  const totalPercentage = totalProratedBudget > 0 ? (totalSpent / totalProratedBudget) * 100 : 0
  const totalRemaining = Math.max(totalProratedBudget - totalSpent, 0)
  const overspentCount = budgetSpending.filter((b) => b.isOverspent).length

  const handleStartEdit = (category: string, currentBudget: number) => {
    hasLocalEditsRef.current = true
    setSaveMessage(null)
    setEditingCategory(category)
    setEditValue(currentBudget.toString())
  }

  const handleSaveEdit = (category: string) => {
    const newBudget = parseFloat(editValue)
    if (!isNaN(newBudget) && newBudget >= 0) {
      saveBudgets({ ...budgets, [category]: newBudget })
      setEditingCategory(null)
      return
    }
    setSaveMessage("Enter a valid amount")
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditValue("")
    hasLocalEditsRef.current = false
  }

  // Chart data for budget vs spending
  const chartData = budgetSpending
    .filter((item) => item.actualSpent > 0 || item.monthlyBudget > 0)
    .map((item) => ({
      category: item.budgetCategory.split(" ")[0],
      fullName: item.budgetCategory,
      budget: Math.round(item.proratedBudget),
      spent: Math.round(item.actualSpent),
    }))

  const isLoading = authLoading || transactionsLoading

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  // Helper to find a category item by name
  const findCat = (name: string) => categories.find((c) => c.name === name)

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
          title="Budget Studio"
          subtitle="Monitor budgets against real-time spend"
          actions={
            <>
              {budgetPeriod && (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {budgetPeriod.periodLabel}
                </Badge>
              )}
              {saveMessage && (
                <Badge variant="outline" className="text-xs">
                  {saveMessage}
                </Badge>
              )}
            </>
          }
        />
        <div className="flex flex-1 flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Skeleton className="h-96 w-full max-w-4xl mx-6" />
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {/* Metric tiles */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Total Spent"
                  value={formatCurrency(totalSpent)}
                  change={totalPercentage > 0 ? -(100 - totalPercentage) : 0}
                  trendLabel="of budget used"
                  tone={totalPercentage >= 90 ? "negative" : totalPercentage >= 70 ? "negative" : "positive"}
                  icon={<IconReceipt2 className="h-5 w-5" />}
                />
                <MetricTile
                  label="Budget Remaining"
                  value={formatCurrency(totalRemaining)}
                  trendLabel="pro-rated budget"
                  tone={totalRemaining > 0 ? "positive" : "negative"}
                  icon={<IconPigMoney className="h-5 w-5" />}
                />
                <MetricTile
                  label="Projected Spend"
                  value={formatCurrency(totalProjected)}
                  change={totalMonthlyBudget > 0 ? ((totalProjected - totalMonthlyBudget) / totalMonthlyBudget) * 100 : 0}
                  trendLabel="vs full budget"
                  tone={totalProjected <= totalMonthlyBudget ? "positive" : "negative"}
                  icon={<IconTrendingDown className="h-5 w-5" />}
                />
                <MetricTile
                  label="Categories Over"
                  value={`${overspentCount} / ${budgetSpending.length}`}
                  trendLabel="categories overspent"
                  tone={overspentCount === 0 ? "positive" : "negative"}
                  icon={<IconTarget className="h-5 w-5" />}
                />
              </div>

              {/* NWI Split Configuration */}
              {nwiConfig && (
                <Card className="border border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Needs / Wants / Investments Split</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Adjust your spending allocation targets (must sum to 100%)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {([
                        { key: "needs" as const, label: "Needs", color: "text-blue-600" },
                        { key: "wants" as const, label: "Wants", color: "text-orange-600" },
                        { key: "investments" as const, label: "Investments", color: "text-emerald-600" },
                      ]).map(item => (
                        <div key={item.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className={`text-sm font-medium ${item.color}`}>{item.label}</Label>
                            <span className="text-sm font-semibold">{nwiDraft[item.key]}%</span>
                          </div>
                          <Input
                            type="range"
                            min={0}
                            max={100}
                            value={nwiDraft[item.key]}
                            onChange={(e) => {
                              const val = parseInt(e.target.value)
                              setNwiDraft(prev => ({ ...prev, [item.key]: val }))
                            }}
                            className="h-2 cursor-pointer"
                          />
                          <p className="text-xs text-muted-foreground">
                            {nwiConfig[item.key].categories.length} categories
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <p className={`text-sm ${
                        nwiDraft.needs + nwiDraft.wants + nwiDraft.investments === 100
                          ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        Total: {nwiDraft.needs + nwiDraft.wants + nwiDraft.investments}%
                        {nwiDraft.needs + nwiDraft.wants + nwiDraft.investments !== 100 && " (must equal 100%)"}
                      </p>
                      <Button
                        size="sm"
                        onClick={saveNwiPercentages}
                        disabled={nwiSaving || nwiDraft.needs + nwiDraft.wants + nwiDraft.investments !== 100}
                      >
                        {nwiSaving ? "Saving..." : "Save Split"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Overall progress */}
              <Card className="border border-border/70">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">Overall Usage</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(totalSpent)} of {formatCurrency(totalProratedBudget)} pro-rated
                      </p>
                    </div>
                    <span className={`text-2xl font-semibold ${
                      totalPercentage >= 90 ? "text-rose-600" :
                      totalPercentage >= 70 ? "text-amber-600" :
                      "text-emerald-600"
                    }`}>
                      {totalPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(totalPercentage, 100)}
                    className={`h-2.5 ${
                      totalPercentage >= 90 ? "[&>div]:bg-rose-500" :
                      totalPercentage >= 70 ? "[&>div]:bg-amber-500" :
                      "[&>div]:bg-emerald-500"
                    }`}
                  />
                </CardContent>
              </Card>

              {/* Chart + Table side by side */}
              <div className="grid gap-4 lg:grid-cols-5">
                {/* Budget vs Spending chart */}
                <Card className="border border-border/70 lg:col-span-3">
                  <CardHeader>
                    <CardTitle>Budget vs Spending</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Pro-rated budget compared to actual spend by category
                    </p>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} barGap={4}>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="category"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              formatCurrency(value),
                              name === "budget" ? "Budget" : "Spent",
                            ]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 12,
                            }}
                          />
                          <Bar dataKey="budget" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                          <Bar dataKey="spent" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                        No spending data yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top overspent / closest to limit */}
                <Card className="border border-border/70 lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Attention Needed</CardTitle>
                    <p className="text-sm text-muted-foreground">Categories closest to or over limit</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[...budgetSpending]
                      .sort((a, b) => b.percentageUsed - a.percentageUsed)
                      .slice(0, 5)
                      .map((item) => (
                        <div key={item.budgetCategory} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.budgetCategory}</span>
                            <span className={`text-xs font-semibold ${
                              item.percentageUsed >= 90 ? "text-rose-600" :
                              item.percentageUsed >= 70 ? "text-amber-600" :
                              "text-emerald-600"
                            }`}>
                              {item.percentageUsed.toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(item.percentageUsed, 100)}
                            className={`h-1.5 ${
                              item.percentageUsed >= 90 ? "[&>div]:bg-rose-500" :
                              item.percentageUsed >= 70 ? "[&>div]:bg-amber-500" :
                              "[&>div]:bg-emerald-500"
                            }`}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(item.actualSpent)}</span>
                            <span>{formatCurrency(item.proratedBudget)}</span>
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>

              {/* Category breakdown table */}
              <Card className="border border-border/70">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Category Breakdown</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Click the edit icon to adjust a category budget. Use the + button to add new categories.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetDialogState()
                        setShowAddDialog(true)
                      }}
                    >
                      <IconPlus className="h-4 w-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Monthly Budget</TableHead>
                        <TableHead className="text-right">Pro-rated</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Projected</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-center w-[100px]">Usage</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetSpending.map((item) => {
                        const isEditing = editingCategory === item.budgetCategory
                        const catItem = findCat(item.budgetCategory)
                        return (
                          <TableRow key={item.budgetCategory} className="h-[56px]">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {item.budgetCategory}
                                {item.isOverspent && (
                                  <IconAlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-24 h-8 text-right text-sm"
                                    disabled={isSaving}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveEdit(item.budgetCategory)
                                      if (e.key === "Escape") handleCancelEdit()
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleSaveEdit(item.budgetCategory)}
                                    disabled={isSaving}
                                  >
                                    <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                  >
                                    <IconX className="h-3.5 w-3.5 text-rose-600" />
                                  </Button>
                                </div>
                              ) : (
                                formatCurrency(item.monthlyBudget)
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatCurrency(item.proratedBudget)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(item.actualSpent)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatCurrency(item.projectedSpent)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${
                              item.remaining < 0 ? "text-rose-600" : "text-emerald-600"
                            }`}>
                              {item.remaining < 0 ? "-" : ""}{formatCurrency(Math.abs(item.remaining))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  item.percentageUsed >= 90
                                    ? "bg-rose-500/10 text-rose-700 border-rose-200"
                                    : item.percentageUsed >= 70
                                      ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                      : "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {item.percentageUsed.toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-0.5">
                                {!isEditing && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleStartEdit(item.budgetCategory, item.monthlyBudget)}
                                    title="Edit budget amount"
                                  >
                                    <IconEdit className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {catItem && !isEditing && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => openRenameDialog(catItem)}
                                      title="Rename category"
                                    >
                                      <IconEdit className="h-3 w-3 text-blue-500" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => openDeleteDialog(catItem)}
                                      title="Delete category"
                                    >
                                      <IconTrash className="h-3 w-3 text-rose-500" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* Totals row */}
                      <TableRow className="border-t-2 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalMonthlyBudget)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(totalProratedBudget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalSpent)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(totalProjected)}</TableCell>
                        <TableCell className={`text-right ${totalRemaining > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(totalRemaining)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              totalPercentage >= 90
                                ? "bg-rose-500/10 text-rose-700 border-rose-200"
                                : totalPercentage >= 70
                                  ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                  : "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {totalPercentage.toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Add Category Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); resetDialogState() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Budget Category</DialogTitle>
            <DialogDescription>Create a new budget category to track spending.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">Category Name</Label>
              <Input
                id="add-name"
                placeholder="e.g. Subscriptions"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory() }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-amount">Monthly Budget (INR)</Label>
              <Input
                id="add-amount"
                type="number"
                placeholder="5000"
                value={newCategoryAmount}
                onChange={(e) => setNewCategoryAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory() }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc">Description (optional)</Label>
              <Input
                id="add-desc"
                placeholder="What this category covers..."
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
              />
            </div>
            {dialogError && (
              <p className="text-sm text-rose-600">{dialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetDialogState() }} disabled={dialogLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={dialogLoading}>
              {dialogLoading ? "Adding..." : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Category Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(open) => { if (!open) { setShowRenameDialog(false); resetDialogState() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription>
              Rename &quot;{dialogTarget?.name}&quot; to a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-name">New Name</Label>
              <Input
                id="rename-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory() }}
                autoFocus
              />
            </div>
            {dialogError && (
              <p className="text-sm text-rose-600">{dialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRenameDialog(false); resetDialogState() }} disabled={dialogLoading}>
              Cancel
            </Button>
            <Button onClick={handleRenameCategory} disabled={dialogLoading}>
              {dialogLoading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); resetDialogState() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{dialogTarget?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p className="text-sm text-rose-600">{dialogError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); resetDialogState() }} disabled={dialogLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={dialogLoading}>
              {dialogLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
