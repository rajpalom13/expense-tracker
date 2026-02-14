"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconFilter,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSquare,
  IconSquareCheck,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import { transformTransactionsForTable } from "@/lib/transform-transactions"
import { calculateDailyTrends } from "@/lib/analytics"
import { isCompletedStatus } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

// All categories available for categorization
const ALL_CATEGORIES = [
  "Salary", "Freelance", "Business", "Investment Income", "Other Income",
  "Rent", "Utilities", "Groceries", "Healthcare", "Insurance", "Transport", "Fuel",
  "Dining", "Entertainment", "Shopping", "Travel", "Education", "Fitness", "Personal Care",
  "Savings", "Investment", "Loan Payment", "Credit Card", "Tax",
  "Subscription", "Gifts", "Charity", "Miscellaneous", "Uncategorized",
]

type CatRule = {
  _id: string
  pattern: string
  matchField: string
  category: string
  caseSensitive: boolean
  enabled: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function TransactionsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { transactions, isLoading: transactionsLoading, refresh } = useTransactions()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState("")
  const [isSavingBulk, setIsSavingBulk] = useState(false)

  // Rules management
  const [showRules, setShowRules] = useState(false)
  const [rules, setRules] = useState<CatRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [ruleForm, setRuleForm] = useState({ pattern: "", matchField: "any", category: "", caseSensitive: false })
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  // NWI classification
  const [nwiConfig, setNwiConfig] = useState<{ needs: { categories: string[] }, wants: { categories: string[] }, investments: { categories: string[] } } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  // Load rules
  const loadRules = useCallback(async () => {
    setIsLoadingRules(true)
    try {
      const res = await fetch("/api/categorization-rules")
      const data = await res.json()
      if (data.success) setRules(data.rules || [])
    } catch { /* ignore */ }
    finally { setIsLoadingRules(false) }
  }, [])

  useEffect(() => { if (isAuthenticated) loadRules() }, [isAuthenticated, loadRules])

  // Fetch NWI config
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/nwi-config')
      .then(res => res.json())
      .then(data => { if (data.success) setNwiConfig(data.config) })
      .catch(() => {})
  }, [isAuthenticated])

  // ─── NWI Classification ───

  function getNWIBucket(category: string, nwiOverride?: string | null): 'N' | 'W' | 'I' {
    if (nwiOverride === 'needs') return 'N'
    if (nwiOverride === 'wants') return 'W'
    if (nwiOverride === 'investments') return 'I'
    if (!nwiConfig) return 'W'
    if (nwiConfig.needs.categories.includes(category)) return 'N'
    if (nwiConfig.investments.categories.includes(category)) return 'I'
    return 'W'
  }

  const nwiBadgeStyles = {
    N: 'bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-500/20 cursor-pointer',
    W: 'bg-orange-500/10 text-orange-700 border-orange-200 hover:bg-orange-500/20 cursor-pointer',
    I: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20 cursor-pointer',
  }

  const nwiLabels = { N: 'Needs', W: 'Wants', I: 'Investments' }

  const handleNWIOverride = async (transactionId: string, currentBucket: 'N' | 'W' | 'I') => {
    const order: ('N' | 'W' | 'I')[] = ['N', 'W', 'I']
    const currentIdx = order.indexOf(currentBucket)
    const nextBucket = order[(currentIdx + 1) % 3]
    const overrideMap = { N: 'needs', W: 'wants', I: 'investments' } as const

    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transactionId, nwiOverride: overrideMap[nextBucket] }),
      })
      if ((await res.json()).success) {
        refresh()
      }
    } catch (err) {
      console.error('Failed to update NWI override:', err)
    }
  }

  // ─── Inline Category Edit ───

  const startEditCategory = (id: string, currentCategory: string) => {
    setEditingId(id)
    setEditCategory(currentCategory)
  }

  const saveCategory = async () => {
    if (!editingId || !editCategory) return
    setIsSavingCategory(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, category: editCategory }),
      })
      if (res.ok) {
        setEditingId(null)
        refresh()
      }
    } catch { /* ignore */ }
    finally { setIsSavingCategory(false) }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCategory("")
  }

  // ─── Bulk Category Update ───

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedData.map((t) => t.id)))
    }
  }

  const saveBulkCategory = async () => {
    if (!selectedIds.size || !bulkCategory) return
    setIsSavingBulk(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), category: bulkCategory }),
      })
      if (res.ok) {
        setSelectedIds(new Set())
        setBulkCategory("")
        refresh()
      }
    } catch { /* ignore */ }
    finally { setIsSavingBulk(false) }
  }

  // ─── Rules CRUD ───

  const addRule = async () => {
    if (!ruleForm.pattern.trim() || !ruleForm.category) return
    setIsSavingRule(true)
    setRuleError(null)
    try {
      const res = await fetch("/api/categorization-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleForm),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRuleForm({ pattern: "", matchField: "any", category: "", caseSensitive: false })
        loadRules()
      } else {
        setRuleError(data.message || "Failed to create rule.")
      }
    } catch { setRuleError("Network error creating rule.") }
    finally { setIsSavingRule(false) }
  }

  const deleteRule = async (id: string) => {
    try {
      await fetch(`/api/categorization-rules?id=${id}`, { method: "DELETE" })
      loadRules()
    } catch { /* ignore */ }
  }

  const toggleRuleEnabled = async (rule: CatRule) => {
    try {
      await fetch(`/api/categorization-rules?id=${rule._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      loadRules()
    } catch { /* ignore */ }
  }

  // ─── Filtering & Pagination ───

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterType === "all" || transaction.type === filterType

      return matchesSearch && matchesFilter
    })
  }, [transactions, searchQuery, filterType])

  const tableData = useMemo(
    () => transformTransactionsForTable(filteredTransactions),
    [filteredTransactions]
  )

  const totalPages = Math.ceil(tableData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = tableData.slice(startIndex, startIndex + itemsPerPage)

  const isLoading = authLoading || transactionsLoading

  const incomeTotal = filteredTransactions
    .filter((t) => t.type === "income" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)
  const expenseTotal = filteredTransactions
    .filter((t) => t.type === "expense" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)
  const netTotal = incomeTotal - expenseTotal

  const dailyTrend = calculateDailyTrends(filteredTransactions)
    .slice(-14)
    .map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      net: item.net,
      expenses: item.expenses,
    }))

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
          title="Transactions"
          subtitle="Filter, review, and re-categorize your activity"
        />
        <div className="flex flex-1 flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Skeleton className="h-96 w-full max-w-4xl mx-6" />
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold">Transaction Ledger</h1>
                  <p className="text-muted-foreground">Track every debit and credit</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowRules(true)}>
                    <IconSettings className="size-4 mr-2" />
                    Rules ({rules.length})
                  </Button>
                  <Button>
                    <IconPlus className="size-4 mr-2" />
                    Add Transaction
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(incomeTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Expenses</p>
                    <p className="text-2xl font-semibold text-rose-600">{formatCurrency(expenseTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="text-2xl font-semibold">{formatCurrency(netTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border/70">
                <CardHeader>
                  <CardTitle>Daily Net Movement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dailyTrend}>
                      <defs>
                        <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="net" stroke="#0ea5e9" fill="url(#netFill)" strokeWidth={3} strokeOpacity={0.95} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Filters + Bulk Actions */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-[260px]">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description, category, payment"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  {(["all", "income", "expense"] as const).map((type) => (
                    <Button
                      key={type}
                      variant={filterType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setFilterType(type)
                        setCurrentPage(1)
                      }}
                    >
                      {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>

                {/* Bulk actions bar */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 ml-auto rounded-lg border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800 px-3 py-1.5">
                    <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {selectedIds.size} selected
                    </span>
                    <Select value={bulkCategory} onValueChange={setBulkCategory}>
                      <SelectTrigger className="h-7 w-[160px] text-xs">
                        <SelectValue placeholder="Assign category" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!bulkCategory || isSavingBulk}
                      onClick={saveBulkCategory}
                    >
                      {isSavingBulk ? "Saving..." : "Apply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Transaction Table */}
              <Card className="border border-border/70">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <button onClick={toggleSelectAll} className="flex items-center justify-center">
                            {selectedIds.size === paginatedData.length && paginatedData.length > 0
                              ? <IconSquareCheck className="size-4 text-indigo-600" />
                              : <IconSquare className="size-4 text-muted-foreground" />
                            }
                          </button>
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.length > 0 ? (
                        paginatedData.map((transaction) => (
                          <TableRow key={transaction.id} className="h-[60px] group">
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(transaction.id)}
                                onCheckedChange={() => toggleSelect(transaction.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {new Date(transaction.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[300px] truncate">{transaction.description}</div>
                              {transaction.merchant && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{transaction.merchant}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingId === transaction.id ? (
                                <div className="flex items-center gap-1">
                                  <Select value={editCategory} onValueChange={setEditCategory}>
                                    <SelectTrigger className="h-7 w-[140px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={saveCategory}
                                    disabled={isSavingCategory}
                                  >
                                    <IconCheck className="size-3.5 text-emerald-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={cancelEdit}
                                  >
                                    <IconX className="size-3.5 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                <button
                                  className="flex items-center gap-1 group/cat"
                                  onClick={() => startEditCategory(transaction.id, transaction.category)}
                                >
                                  <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
                                    {transaction.category}
                                  </Badge>
                                  <IconEdit className="size-3 text-muted-foreground opacity-0 group-hover/cat:opacity-100 group-hover:opacity-60 transition-opacity" />
                                </button>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${nwiBadgeStyles[getNWIBucket(transaction.category, (transaction as any).nwiOverride)]}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleNWIOverride(transaction.id, getNWIBucket(transaction.category, (transaction as any).nwiOverride))
                                  }}
                                  title={`${nwiLabels[getNWIBucket(transaction.category, (transaction as any).nwiOverride)]} — click to change`}
                                >
                                  {getNWIBucket(transaction.category, (transaction as any).nwiOverride)}
                                </Badge>
                              </div>
                              )}
                            </TableCell>
                            <TableCell>{transaction.paymentMethod}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  transaction.type === "income"
                                    ? "text-emerald-600 font-semibold"
                                    : "text-rose-600 font-semibold"
                                }
                              >
                                {transaction.type === "income" ? "+" : "-"}
                                {formatCurrency(transaction.amount)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50].map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size} rows
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground ml-2">
                    {tableData.length} total
                  </span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <IconChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <IconChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Rules Management Dialog */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorization Rules</DialogTitle>
            <DialogDescription>
              Rules are applied automatically when transactions are imported. First matching rule wins. Manual category overrides are preserved during re-import.
            </DialogDescription>
          </DialogHeader>

          {/* Add new rule */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="text-sm font-medium">Add Rule</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Pattern (substring match)</Label>
                <Input
                  placeholder='e.g. "GROWSY" or "swiggy"'
                  value={ruleForm.pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Match Field</Label>
                <Select value={ruleForm.matchField} onValueChange={(v) => setRuleForm({ ...ruleForm, matchField: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any (description + merchant)</SelectItem>
                    <SelectItem value="description">Description only</SelectItem>
                    <SelectItem value="merchant">Merchant only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Assign Category</Label>
                <Select value={ruleForm.category} onValueChange={(v) => setRuleForm({ ...ruleForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                  <Checkbox
                    checked={ruleForm.caseSensitive}
                    onCheckedChange={(checked) => setRuleForm({ ...ruleForm, caseSensitive: checked === true })}
                  />
                  Case sensitive
                </label>
                <Button size="sm" onClick={addRule} disabled={isSavingRule || !ruleForm.pattern.trim() || !ruleForm.category}>
                  <IconPlus className="mr-1 size-4" /> {isSavingRule ? "Adding..." : "Add Rule"}
                </Button>
              </div>
            </div>
            {ruleError && <div className="text-xs text-rose-600">{ruleError}</div>}
          </div>

          {/* Existing rules */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Active Rules ({rules.length})</div>
            {isLoadingRules ? (
              <Skeleton className="h-20" />
            ) : rules.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                No rules yet. Add a rule above to auto-categorize transactions on import.
              </div>
            ) : (
              <div className="space-y-1.5">
                {rules.map((rule) => (
                  <div
                    key={rule._id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${rule.enabled ? "border-border/70" : "border-border/40 opacity-50"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rule.pattern}</code>
                        <span className="text-[10px] text-muted-foreground">
                          in {rule.matchField === "any" ? "any field" : rule.matchField}
                        </span>
                        <IconChevronRight className="size-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">{rule.category}</Badge>
                        {rule.caseSensitive && <Badge variant="outline" className="text-[9px]">Aa</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleRuleEnabled(rule)}
                        title={rule.enabled ? "Disable" : "Enable"}
                      >
                        {rule.enabled
                          ? <IconCheck className="size-3.5 text-emerald-600" />
                          : <IconX className="size-3.5 text-muted-foreground" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteRule(rule._id)}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRules(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
