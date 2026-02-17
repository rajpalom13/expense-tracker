"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSquare,
  IconSquareCheck,
  IconTrash,
  IconX,
  IconArrowUpRight,
  IconArrowDownRight,
  IconReceipt,
  IconFilter,
  IconFilterOff,
  IconCreditCard,
  IconCash,
  IconDeviceMobile,
  IconBuildingBank,
  IconWallet,
  IconDots,
  IconTrendingUp,
  IconRepeat,
  IconDownload,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react"

import { toast } from "sonner"
import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/hooks/use-auth"
import { useNWIConfig } from "@/hooks/use-nwi-config"
import { transformTransactionsForTable } from "@/lib/transform-transactions"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { InfoTooltip } from "@/components/info-tooltip"
import { stagger, fadeUp, fadeUpSmall, listItem } from "@/lib/motion"

const ALL_PAYMENT_METHODS = [
  "Cash", "Debit Card", "Credit Card", "UPI", "NEFT", "IMPS", "Net Banking", "Wallet", "Cheque", "Other",
]

const FALLBACK_CATEGORIES = [
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

import { formatINR as formatCurrency } from "@/lib/format"
import { isOneTimePurchase, isOutlierTransaction } from "@/lib/edge-cases"
import { isSimilarMerchant } from "@/lib/categorizer"

// Category color mapping for rich badges
const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Salary":            { bg: "bg-emerald-100/70 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Freelance":         { bg: "bg-emerald-100/70 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Business":          { bg: "bg-emerald-100/70 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Investment Income": { bg: "bg-emerald-100/70 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Other Income":      { bg: "bg-emerald-100/70 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Rent":              { bg: "bg-rose-100/70 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  "Utilities":         { bg: "bg-amber-100/70 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "Groceries":         { bg: "bg-lime-100/70 dark:bg-lime-900/30", text: "text-lime-700 dark:text-lime-400", dot: "bg-lime-500" },
  "Healthcare":        { bg: "bg-red-100/70 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  "Insurance":         { bg: "bg-orange-100/70 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
  "Transport":         { bg: "bg-sky-100/70 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  "Fuel":              { bg: "bg-sky-100/70 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  "Dining":            { bg: "bg-orange-100/70 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
  "Entertainment":     { bg: "bg-purple-100/70 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  "Shopping":          { bg: "bg-pink-100/70 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
  "Travel":            { bg: "bg-indigo-100/70 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  "Education":         { bg: "bg-blue-100/70 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  "Fitness":           { bg: "bg-teal-100/70 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-400", dot: "bg-teal-500" },
  "Personal Care":     { bg: "bg-fuchsia-100/70 dark:bg-fuchsia-900/30", text: "text-fuchsia-700 dark:text-fuchsia-400", dot: "bg-fuchsia-500" },
  "Savings":           { bg: "bg-cyan-100/70 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
  "Investment":        { bg: "bg-violet-100/70 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  "Loan Payment":      { bg: "bg-red-100/70 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  "Credit Card":       { bg: "bg-slate-100/70 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
  "Tax":               { bg: "bg-stone-100/70 dark:bg-stone-800/50", text: "text-stone-700 dark:text-stone-300", dot: "bg-stone-500" },
  "Subscription":      { bg: "bg-violet-100/70 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  "Gifts":             { bg: "bg-pink-100/70 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
  "Charity":           { bg: "bg-amber-100/70 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "Miscellaneous":     { bg: "bg-gray-100/70 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  "Uncategorized":     { bg: "bg-gray-100/70 dark:bg-gray-800/50", text: "text-gray-500 dark:text-gray-500", dot: "bg-gray-400" },
}

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || { bg: "bg-gray-100/70 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" }
}

/** Display-only cleanup of bank-mangled merchant names */
function cleanMerchantName(name: string): string {
  if (!name) return name
  return name
    .replace(/\s*\|\s*/g, ' ')          // Remove pipe characters
    .replace(/\s{2,}/g, ' ')            // Collapse multiple spaces
    .replace(/[_]+/g, ' ')              // Replace underscores with spaces
    .trim()
}

// Payment method icon helper
function PaymentMethodIcon({ method, className = "size-3.5" }: { method: string; className?: string }) {
  switch (method) {
    case "Credit Card":
    case "Debit Card":
      return <IconCreditCard className={className} />
    case "Cash":
      return <IconCash className={className} />
    case "UPI":
      return <IconDeviceMobile className={className} />
    case "NEFT":
    case "IMPS":
    case "Net Banking":
      return <IconBuildingBank className={className} />
    case "Wallet":
      return <IconWallet className={className} />
    default:
      return <IconDots className={className} />
  }
}

export default function TransactionsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { transactions, isLoading: transactionsLoading, error: transactionsError, refresh, syncFromSheets, isSyncing } = useTransactions()

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

  // Add Transaction dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    date: new Date().toISOString().split("T")[0],
    category: "Uncategorized",
    paymentMethod: "UPI",
  })
  const [isAddingTransaction, setIsAddingTransaction] = useState(false)

  // Rules management
  const [showRules, setShowRules] = useState(false)
  const [rules, setRules] = useState<CatRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [ruleForm, setRuleForm] = useState({ pattern: "", matchField: "any", category: "", caseSensitive: false })
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ pattern: "", matchField: "any", category: "", caseSensitive: false })

  // Smart categorization
  const [showSmartCatDialog, setShowSmartCatDialog] = useState(false)
  const [smartCatData, setSmartCatData] = useState<{
    merchant: string
    category: string
    matches: { id: string; date: string; description: string; merchant: string; amount: number; type: string; category: string }[]
    selectedIds: Set<string>
  } | null>(null)
  const [isSavingSmartCat, setIsSavingSmartCat] = useState(false)
  const [smartCatCreateRule, setSmartCatCreateRule] = useState(true)

  // NWI classification
  const [nwiConfig, setNwiConfig] = useState<{ needs: { categories: string[] }, wants: { categories: string[] }, investments: { categories: string[] }, savings?: { categories: string[] } } | null>(null)

  // Budget-derived categories
  const [budgetCategories, setBudgetCategories] = useState<string[]>([])

  // Recurring transactions
  const [recurringMerchants, setRecurringMerchants] = useState<Set<string>>(new Set())
  const [showRecurringOnly, setShowRecurringOnly] = useState(false)

  // Sort state
  const [sortField, setSortField] = useState<"date" | "description" | "category" | "amount" | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Delete state
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  // Fetch budget category NAMES (e.g. "Food & Dining", "Transport") for dropdowns
  const loadBudgetCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/budget-categories", { credentials: "include" })
      const data = await res.json()
      if (data.success && Array.isArray(data.categories)) {
        const names = data.categories.map((bc: { name: string }) => bc.name).sort()
        if (names.length > 0) setBudgetCategories(names)
      }
    } catch { /* fallback to FALLBACK_CATEGORIES */ }
  }, [])

  useEffect(() => { if (isAuthenticated) loadBudgetCategories() }, [isAuthenticated, loadBudgetCategories])

  // Use budget-derived categories when available, otherwise full list
  const ALL_CATEGORIES = budgetCategories.length > 0 ? budgetCategories : FALLBACK_CATEGORIES

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

  const { data: nwiConfigData } = useNWIConfig()

  useEffect(() => {
    if (nwiConfigData?.success && nwiConfigData.config) {
      setNwiConfig(nwiConfigData.config)
    }
  }, [nwiConfigData])

  // Fetch recurring transaction merchants
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/recurring', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.recurring)) {
          const merchants = new Set<string>(
            data.recurring.map((r: { merchant: string }) => r.merchant.toLowerCase())
          )
          setRecurringMerchants(merchants)
        }
      })
      .catch(() => {}) // silent fail - recurring badges are optional
  }, [isAuthenticated])

  function getNWIBucket(category: string, nwiOverride?: string | null): 'N' | 'W' | 'I' | 'S' {
    if (nwiOverride === 'needs') return 'N'
    if (nwiOverride === 'wants') return 'W'
    if (nwiOverride === 'investments') return 'I'
    if (nwiOverride === 'savings') return 'S'
    if (!nwiConfig) return 'W'
    if (nwiConfig.needs.categories.includes(category)) return 'N'
    if (nwiConfig.savings?.categories?.includes(category)) return 'S'
    if (nwiConfig.investments.categories.includes(category)) return 'I'
    return 'W'
  }

  const nwiLabels = { N: 'Needs', W: 'Wants', I: 'Investments', S: 'Savings' }

  const handleNWIOverride = async (transactionId: string, currentBucket: 'N' | 'W' | 'I' | 'S') => {
    const order: ('N' | 'W' | 'I' | 'S')[] = ['N', 'W', 'I', 'S']
    const currentIdx = order.indexOf(currentBucket)
    const nextBucket = order[(currentIdx + 1) % 4]
    const overrideMap = { N: 'needs', W: 'wants', I: 'investments', S: 'savings' } as const

    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transactionId, nwiOverride: overrideMap[nextBucket] }),
      })
      if ((await res.json()).success) {
        refresh()
      } else {
        toast.error("Failed to update NWI classification")
      }
    } catch (err) {
      console.error('Failed to update NWI override:', err)
      toast.error("Network error updating NWI classification")
    }
  }

  // Check if a transaction is recurring based on merchant name matching
  const isRecurring = useCallback((txn: { merchant?: string; description?: string }) => {
    if (recurringMerchants.size === 0) return false
    const merchant = (txn.merchant || txn.description || '').toLowerCase()
    if (!merchant) return false
    return recurringMerchants.has(merchant) ||
      Array.from(recurringMerchants).some(rm => merchant.includes(rm) || rm.includes(merchant))
  }, [recurringMerchants])

  // Delete a single transaction
  const handleDelete = async (id: string) => {
    setIsDeletingId(id)
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        toast.success("Transaction deleted")
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        refresh()
      } else {
        toast.error(data.message || "Failed to delete transaction")
      }
    } catch {
      toast.error("Failed to delete transaction")
    } finally {
      setIsDeletingId(null)
    }
  }

  // Bulk delete selected transactions
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return

    // Look up _id from the raw transactions array
    const idsToDelete = transactions
      .filter(t => selectedIds.has(t.id))
      .map(t => (t as unknown as Record<string, unknown>)._id as string)
      .filter((id): id is string => !!id)

    if (idsToDelete.length === 0) {
      toast.error("No valid transactions to delete")
      return
    }

    setIsBulkDeleting(true)
    try {
      const res = await fetch(`/api/transactions?ids=${idsToDelete.join(',')}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Deleted ${data.deletedCount} transaction${data.deletedCount !== 1 ? 's' : ''}`)
        setSelectedIds(new Set())
        refresh()
      } else {
        toast.error(data.message || "Failed to delete transactions")
      }
    } catch {
      toast.error("Failed to delete transactions")
    } finally {
      setIsBulkDeleting(false)
    }
  }, [selectedIds, transactions, refresh])

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
        const editedTxn = transactions.find((t) => t.id === editingId)
        const newCategory = editCategory
        setEditingId(null)
        refresh()
        toast.success("Category updated")

        if (editedTxn?.merchant || editedTxn?.description) {
          const merchantKey = (editedTxn.merchant || "").trim()
          const descriptionKey = (editedTxn.description || "").trim()
          const similar = transactions.filter((t) => {
            if (t.id === editingId) return false
            if (t.category === newCategory) return false
            const m = (t.merchant || "").trim()
            const d = (t.description || "").trim()
            // Match on merchant name using fuzzy matching from categorizer
            if (merchantKey && m && isSimilarMerchant(m, merchantKey)) return true
            // Also match on description if merchant is missing but descriptions match
            if (!m && !merchantKey && d && descriptionKey && isSimilarMerchant(d, descriptionKey)) return true
            // Cross-match: merchant of one vs description of other
            if (merchantKey && d && isSimilarMerchant(d, merchantKey)) return true
            if (m && descriptionKey && isSimilarMerchant(m, descriptionKey)) return true
            return false
          })
          if (similar.length > 0) {
            setSmartCatData({
              merchant: editedTxn.merchant,
              category: newCategory,
              matches: similar.map((t) => ({
                id: t.id,
                date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
                description: t.description,
                merchant: t.merchant || "",
                amount: t.amount,
                type: t.type,
                category: t.category,
              })),
              selectedIds: new Set(similar.map((t) => t.id)),
            })
            setSmartCatCreateRule(true)
            setShowSmartCatDialog(true)
          }
        }
      } else {
        toast.error("Failed to update category")
      }
    } catch {
      toast.error("Network error", { description: "Could not save category. Please try again." })
    }
    finally { setIsSavingCategory(false) }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCategory("")
  }

  const toggleSort = (field: "date" | "description" | "category" | "amount") => {
    if (sortField === field) {
      if (sortDir === "desc") setSortDir("asc")
      else { setSortField(null); setSortDir("desc") }
    } else {
      setSortField(field)
      setSortDir("desc")
    }
    setCurrentPage(1)
  }

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
        toast.success(`Updated ${selectedIds.size} transactions to "${bulkCategory}"`)
        setSelectedIds(new Set())
        setBulkCategory("")
        refresh()
      } else {
        toast.error("Failed to update categories")
      }
    } catch {
      toast.error("Network error", { description: "Could not apply bulk update. Please try again." })
    }
    finally { setIsSavingBulk(false) }
  }

  // Apply all enabled rules to existing transactions and refresh the list
  const applyRulesToExisting = async () => {
    try {
      const res = await fetch("/api/transactions/recategorize", { method: "POST", credentials: "include" })
      const data = await res.json()
      if (res.ok && data.success && data.updated > 0) {
        toast.success(`Applied rules to ${data.updated} transaction${data.updated === 1 ? "" : "s"}`)
        refresh()
      }
    } catch { /* silent — rule was saved, recategorize is best-effort */ }
  }

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
        toast.success("Rule created", { description: `Pattern "${ruleForm.pattern}" will map to ${ruleForm.category}` })
        // Auto-apply rules to existing transactions
        applyRulesToExisting()
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
      toast.success("Rule deleted")
    } catch {
      toast.error("Failed to delete rule")
    }
  }

  const deleteAllRules = async () => {
    if (!rules.length) return
    try {
      const res = await fetch("/api/categorization-rules?all=true", { method: "DELETE" })
      const data = await res.json()
      loadRules()
      toast.success(`Deleted ${data.deleted || rules.length} rules`)
    } catch {
      toast.error("Failed to delete rules")
      loadRules()
    }
  }

  const applySmartCategorization = async () => {
    if (!smartCatData || smartCatData.selectedIds.size === 0) return
    setIsSavingSmartCat(true)
    try {
      const ids = Array.from(smartCatData.selectedIds)
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, category: smartCatData.category }),
      })
      if (res.ok) {
        toast.success(`Updated ${ids.length} similar transactions to "${smartCatData.category}"`)

        if (smartCatCreateRule && smartCatData.merchant) {
          await fetch("/api/categorization-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pattern: smartCatData.merchant,
              matchField: "merchant",
              category: smartCatData.category,
              caseSensitive: false,
            }),
          })
          loadRules()
          toast.success(`Rule created: "${smartCatData.merchant}" -> ${smartCatData.category}`)
        }

        setShowSmartCatDialog(false)
        setSmartCatData(null)
        refresh()
      } else {
        toast.error("Failed to apply bulk categorization")
      }
    } catch {
      toast.error("Network error applying bulk categorization")
    }
    finally { setIsSavingSmartCat(false) }
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

  const startEditRule = (rule: CatRule) => {
    setEditingRuleId(rule._id)
    setEditForm({ pattern: rule.pattern, matchField: rule.matchField, category: rule.category, caseSensitive: rule.caseSensitive })
  }

  const cancelEditRule = () => {
    setEditingRuleId(null)
  }

  const saveEditRule = async () => {
    if (!editingRuleId || !editForm.pattern.trim() || !editForm.category) return
    try {
      await fetch(`/api/categorization-rules?id=${editingRuleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      setEditingRuleId(null)
      loadRules()
      toast.success("Rule updated")
      // Auto-apply rules to existing transactions
      applyRulesToExisting()
    } catch {
      toast.error("Failed to update rule")
    }
  }

  const handleAddTransaction = async () => {
    const amount = parseFloat(addForm.amount)
    if (!addForm.description.trim() || isNaN(amount) || amount <= 0 || !addForm.date) {
      toast.error("Please fill all required fields with valid values")
      return
    }
    setIsAddingTransaction(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: addForm.description.trim(),
          amount,
          type: addForm.type,
          date: addForm.date,
          category: addForm.category,
          paymentMethod: addForm.paymentMethod,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Transaction added")
        setShowAddDialog(false)
        setAddForm({
          description: "",
          amount: "",
          type: "expense",
          date: new Date().toISOString().split("T")[0],
          category: "Uncategorized",
          paymentMethod: "UPI",
        })
        refresh()
      } else {
        toast.error(data.message || "Failed to add transaction")
      }
    } catch {
      toast.error("Network error adding transaction")
    } finally {
      setIsAddingTransaction(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (transaction.merchant || "").toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterType === "all" || transaction.type === filterType

      const matchesRecurring = !showRecurringOnly || isRecurring(transaction)

      return matchesSearch && matchesFilter && matchesRecurring
    })
  }, [transactions, searchQuery, filterType, showRecurringOnly, isRecurring])

  const tableData = useMemo(() => {
    const data = transformTransactionsForTable(filteredTransactions)
    if (!sortField) return data
    return [...data].sort((a, b) => {
      let cmp = 0
      if (sortField === "date") cmp = a.date.localeCompare(b.date)
      else if (sortField === "description") cmp = a.description.localeCompare(b.description)
      else if (sortField === "category") cmp = a.category.localeCompare(b.category)
      else if (sortField === "amount") cmp = a.amount - b.amount
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filteredTransactions, sortField, sortDir])

  const totalPages = Math.ceil(tableData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = tableData.slice(startIndex, startIndex + itemsPerPage)

  const isLoading = authLoading || transactionsLoading

  const currentMonthTransactions = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    return filteredTransactions.filter((t) => {
      const d = new Date(t.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
  }, [filteredTransactions])

  const incomeTotal = currentMonthTransactions
    .filter((t) => t.type === "income" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)
  const expenseTotal = currentMonthTransactions
    .filter((t) => t.type === "expense" && isCompletedStatus(t.status))
    .reduce((sum, t) => sum + t.amount, 0)
  const netTotal = incomeTotal - expenseTotal

  const dailyAvgSpend = React.useMemo(() => {
    const now = new Date()
    const daysElapsed = now.getDate()
    return daysElapsed > 0 ? expenseTotal / daysElapsed : 0
  }, [expenseTotal])

  const hasActiveFilters = searchQuery !== "" || filterType !== "all" || showRecurringOnly

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
            <TransactionsLoadingSkeleton />
          ) : transactionsError ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <IconAlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Failed to load transactions</h3>
                <p className="text-sm text-muted-foreground mt-1">{transactionsError}</p>
              </div>
              <Button variant="outline" onClick={() => refresh()}>
                <IconRefresh className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : (
            <motion.div
              className="space-y-4 p-4 md:p-6"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {/* Stat Summary Cards */}
              <motion.div
                variants={fadeUp}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {/* Income Card */}
                <div className="card-elevated rounded-xl bg-card p-4 flex items-center gap-4">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                    <IconArrowUpRight className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Income</p>
                    <p className="text-xl font-semibold text-primary tabular-nums truncate">{formatCurrency(incomeTotal)}</p>
                  </div>
                </div>

                {/* Expenses Card */}
                <div className="card-elevated rounded-xl bg-card p-4 flex items-center gap-4">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                    <IconArrowDownRight className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Expenses</p>
                    <p className="text-xl font-semibold tabular-nums truncate">{formatCurrency(expenseTotal)}</p>
                  </div>
                </div>

                {/* Net Card */}
                <div className="card-elevated rounded-xl bg-card p-4 flex items-center gap-4">
                  <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${netTotal >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                    <IconTrendingUp className={`size-5 ${netTotal >= 0 ? "text-primary" : "text-destructive"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Net</p>
                    <p className={`text-xl font-semibold tabular-nums truncate ${netTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                      {netTotal >= 0 ? "+" : ""}{formatCurrency(netTotal)}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Search / Filter Toolbar */}
              <motion.div
                variants={fadeUpSmall}
                className="card-elevated rounded-xl bg-card p-3 flex flex-wrap items-center gap-3"
              >
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px] max-w-[380px]">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Search by description, category, or merchant..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-9 h-9 bg-muted/40 border-transparent focus:border-border focus:bg-background transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setCurrentPage(1) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted transition-colors"
                    >
                      <IconX className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Filter Type Toggle */}
                <div className="flex items-center rounded-lg bg-muted/50 p-0.5 gap-0.5">
                  {(["all", "income", "expense"] as const).map((type) => (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        filterType === type
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setFilterType(type)
                        setCurrentPage(1)
                      }}
                    >
                      {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Recurring Toggle */}
                <Button
                  variant={showRecurringOnly ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    setShowRecurringOnly(!showRecurringOnly)
                    setCurrentPage(1)
                  }}
                >
                  <IconRepeat className="size-3.5" />
                  <span className="hidden sm:inline">Recurring</span>
                </Button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground gap-1.5"
                    onClick={() => { setSearchQuery(""); setFilterType("all"); setShowRecurringOnly(false); setCurrentPage(1) }}
                  >
                    <IconFilterOff className="size-3.5" />
                    Clear
                  </Button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Transaction Count */}
                <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                  {tableData.length} transaction{tableData.length !== 1 ? "s" : ""}
                </span>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          const params = new URLSearchParams()
                          if (filterType !== "all") params.set("type", filterType)
                          const url = `/api/reports/export${params.toString() ? `?${params}` : ""}`
                          window.open(url, "_blank")
                        }}
                      >
                        <IconDownload className="size-3.5" />
                        <span className="hidden sm:inline">CSV</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download CSV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setShowRules(true)}
                      >
                        <IconSettings className="size-3.5" />
                        <span className="hidden sm:inline">Rules</span>
                        {rules.length > 0 && (
                          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                            {rules.length}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Categorization Rules</TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <IconPlus className="size-3.5" />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </motion.div>

              {/* Bulk Actions Bar */}
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                          <IconCheck className="size-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-primary">
                          {selectedIds.size} selected
                        </span>
                      </div>
                      <div className="h-4 w-px bg-primary/20" />
                      <Select value={bulkCategory} onValueChange={setBulkCategory}>
                        <SelectTrigger className="h-8 w-[160px] text-xs border-primary/20 bg-background/60">
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
                        className="h-8 text-xs"
                        disabled={!bulkCategory || isSavingBulk}
                        onClick={saveBulkCategory}
                      >
                        {isSavingBulk ? "Saving..." : "Apply"}
                      </Button>
                      <div className="h-4 w-px bg-primary/20" />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                            disabled={isBulkDeleting}
                          >
                            <IconTrash className="size-3.5" />
                            {isBulkDeleting ? "Deleting..." : `Delete (${selectedIds.size})`}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {selectedIds.size} selected transaction{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleBulkDelete}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        Deselect all
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction Table */}
              <motion.div variants={fadeUp} className="card-elevated rounded-xl bg-card overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="w-[40px] pl-4">
                        <button onClick={toggleSelectAll} className="flex items-center justify-center">
                          {selectedIds.size === paginatedData.length && paginatedData.length > 0
                            ? <IconSquareCheck className="size-4 text-primary" />
                            : <IconSquare className="size-4 text-muted-foreground/40" />
                          }
                        </button>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-[90px]">
                        <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          Date
                          {sortField === "date" ? (sortDir === "asc" ? <IconSortAscending className="size-3.5" /> : <IconSortDescending className="size-3.5" />) : <IconArrowsSort className="size-3.5 opacity-0 group-hover:opacity-40" />}
                        </button>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        <button onClick={() => toggleSort("description")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          Description
                          {sortField === "description" ? (sortDir === "asc" ? <IconSortAscending className="size-3.5" /> : <IconSortDescending className="size-3.5" />) : null}
                        </button>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        <span className="inline-flex items-center gap-1">
                          <button onClick={() => toggleSort("category")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                            Category
                            {sortField === "category" ? (sortDir === "asc" ? <IconSortAscending className="size-3.5" /> : <IconSortDescending className="size-3.5" />) : null}
                          </button>
                          <InfoTooltip text="Click a category badge to change it." iconClassName="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hidden lg:table-cell">Method</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 pr-4">
                        <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                          Amount
                          {sortField === "amount" ? (sortDir === "asc" ? <IconSortAscending className="size-3.5" /> : <IconSortDescending className="size-3.5" />) : null}
                        </button>
                      </TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((transaction, i) => {
                        const catColor = getCategoryColor(transaction.category)
                        const isOutlier = transaction.type === "expense" && isOutlierTransaction(transaction.amount, dailyAvgSpend)
                        const isBigPurchase = transaction.type === "expense" && isOneTimePurchase(transaction.amount)

                        return (
                          <motion.tr
                            key={transaction.id}
                            {...listItem(i)}
                            className={`group border-b border-border/20 transition-all duration-200
                              ${selectedIds.has(transaction.id)
                                ? "bg-primary/[0.04] shadow-sm"
                                : isOutlier
                                  ? "bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                                  : "hover:bg-muted/50"
                              }`}
                          >
                            {/* Checkbox */}
                            <TableCell className="pl-4">
                              <Checkbox
                                checked={selectedIds.has(transaction.id)}
                                onCheckedChange={() => toggleSelect(transaction.id)}
                              />
                            </TableCell>

                            {/* Date */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-medium tabular-nums text-foreground">
                                  {new Date(transaction.date).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    timeZone: "Asia/Kolkata",
                                  })}
                                </span>
                                <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                                  {new Date(transaction.date).toLocaleDateString("en-IN", {
                                    year: "numeric",
                                    timeZone: "Asia/Kolkata",
                                  })}
                                </span>
                              </div>
                            </TableCell>

                            {/* Description */}
                            <TableCell>
                              <div className="max-w-[360px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-[13px] font-medium truncate cursor-default text-foreground">
                                      {cleanMerchantName(transaction.merchant || transaction.description)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[400px]">
                                    {cleanMerchantName(transaction.merchant || transaction.description)}
                                  </TooltipContent>
                                </Tooltip>
                                {transaction.merchant && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-[11px] text-muted-foreground/60 truncate max-w-[320px] cursor-default mt-0.5">{cleanMerchantName(transaction.description)}</div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-[400px]">
                                      {transaction.description}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>

                            {/* Category */}
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
                                    <IconCheck className="size-3.5 text-primary" />
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
                                <button
                                  className="flex items-center gap-1.5 group/cat"
                                  onClick={() => startEditCategory(transaction.id, transaction.category)}
                                >
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer
                                      ${catColor.bg} ${catColor.text}
                                      hover:ring-1 hover:ring-current/20 hover:shadow-sm`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${catColor.dot}`} />
                                    {transaction.category}
                                  </span>
                                  <IconEdit className="size-3 text-muted-foreground opacity-0 group-hover/cat:opacity-100 group-hover:opacity-60 transition-opacity" />
                                </button>
                              )}
                            </TableCell>

                            {/* Payment Method */}
                            <TableCell className="hidden lg:table-cell">
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                                <PaymentMethodIcon method={transaction.paymentMethod} className="size-3" />
                                {transaction.paymentMethod}
                              </span>
                            </TableCell>

                            {/* Amount */}
                            <TableCell className="text-right pr-2">
                              <div className="flex items-center justify-end gap-2">
                                {isRecurring(transaction) && (
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] px-1.5 py-0 border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/5"
                                  >
                                    Recurring
                                  </Badge>
                                )}
                                {(isBigPurchase || (!isBigPurchase && isOutlier)) && (
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] px-1.5 py-0 border-amber-300/50 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                  >
                                    {isBigPurchase ? "Big" : "High"}
                                  </Badge>
                                )}
                                <span
                                  className={`text-[13px] font-semibold tabular-nums ${
                                    transaction.type === "income"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrency(transaction.amount)}
                                </span>
                              </div>
                            </TableCell>

                            {/* Delete */}
                            <TableCell className="pr-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    disabled={isDeletingId === (transaction._id || transaction.id)}
                                  >
                                    <IconTrash className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Delete &quot;{transaction.merchant || transaction.description}&quot; ({formatCurrency(transaction.amount)})? This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(transaction._id || transaction.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </motion.tr>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center">
                          {transactions.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-6">
                              <div className="rounded-full bg-muted p-4">
                                <IconReceipt className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                              <div className="space-y-1 text-center">
                                <p className="text-sm font-medium text-foreground">No transactions yet</p>
                                <p className="text-xs text-muted-foreground">Connect your Google Sheets to import bank data.</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => syncFromSheets()} disabled={isSyncing} className="mt-1">
                                <IconRefresh className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                                {isSyncing ? "Syncing..." : "Sync Now"}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3 py-6">
                              <div className="rounded-full bg-muted p-4">
                                <IconSearch className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                              <div className="space-y-1 text-center">
                                <p className="text-sm font-medium text-foreground">No matching transactions</p>
                                <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilterType("all"); setShowRecurringOnly(false) }} className="mt-1">
                                <IconFilterOff className="mr-2 h-3.5 w-3.5" />
                                Clear Filters
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>

              {/* Pagination */}
              <motion.div variants={fadeUpSmall} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50].map((size) => (
                        <SelectItem key={size} value={size.toString()} className="text-xs">
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">per page</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <IconChevronLeft className="size-4" />
                    </Button>

                    {/* Page number buttons */}
                    {(() => {
                      const pages: (number | "...")[] = []
                      if (totalPages <= 7) {
                        for (let p = 1; p <= totalPages; p++) pages.push(p)
                      } else {
                        pages.push(1)
                        if (currentPage > 3) pages.push("...")
                        for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
                          pages.push(p)
                        }
                        if (currentPage < totalPages - 2) pages.push("...")
                        pages.push(totalPages)
                      }
                      return pages.map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
                        ) : (
                          <Button
                            key={p}
                            variant={currentPage === p ? "default" : "ghost"}
                            size="icon"
                            className={`h-8 w-8 text-xs ${currentPage === p ? "" : "text-muted-foreground"}`}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        )
                      )
                    })()}

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <IconChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </div>
      </SidebarInset>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Manually add a new transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description *</Label>
              <Input
                placeholder="e.g. Grocery shopping at BigBasket"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type *</Label>
                <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v as "income" | "expense" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date *</Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={addForm.category} onValueChange={(v) => setAddForm({ ...addForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Method</Label>
                <Select value={addForm.paymentMethod} onValueChange={(v) => setAddForm({ ...addForm, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddTransaction} disabled={isAddingTransaction}>
              {isAddingTransaction ? "Adding..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Management Dialog */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSettings className="size-5 text-muted-foreground" />
              Categorization Rules
            </DialogTitle>
            <DialogDescription>
              Rules are applied automatically when transactions are imported. First matching rule wins.
            </DialogDescription>
          </DialogHeader>

          {/* Add Rule Form */}
          <div className="space-y-3 rounded-xl border border-border/60 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconPlus className="size-4 text-primary" />
              New Rule
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pattern (substring match)</Label>
                <Input
                  placeholder='e.g. "GROWSY" or "swiggy"'
                  value={ruleForm.pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Match Field</Label>
                <Select value={ruleForm.matchField} onValueChange={(v) => setRuleForm({ ...ruleForm, matchField: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any (description + merchant)</SelectItem>
                    <SelectItem value="description">Description only</SelectItem>
                    <SelectItem value="merchant">Merchant only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign Category</Label>
                <Select value={ruleForm.category} onValueChange={(v) => setRuleForm({ ...ruleForm, category: v })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Select category" /></SelectTrigger>
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
                  <IconPlus className="mr-1 size-3.5" /> {isSavingRule ? "Adding..." : "Add Rule"}
                </Button>
              </div>
            </div>
            {ruleError && <div className="text-xs text-destructive flex items-center gap-1.5"><IconAlertCircle className="size-3.5" />{ruleError}</div>}
          </div>

          {/* Active Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Active Rules ({rules.length})</div>
            </div>
            {isLoadingRules ? (
              <div className="space-y-2">
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center border rounded-xl border-dashed bg-muted/10">
                <IconFilter className="size-6 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No rules yet</p>
                <p className="text-xs text-muted-foreground/70">Add a rule above to auto-categorize transactions on import.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {rules.map((rule) => (
                  editingRuleId === rule._id ? (
                    <div key={rule._id} className="rounded-xl border border-primary/40 px-4 py-3 bg-primary/[0.02] space-y-2.5">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={editForm.pattern}
                          onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                          placeholder="Pattern"
                          className="h-8 text-xs"
                        />
                        <Select value={editForm.matchField} onValueChange={(v) => setEditForm({ ...editForm, matchField: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any (description + merchant)</SelectItem>
                            <SelectItem value="description">Description only</SelectItem>
                            <SelectItem value="merchant">Merchant only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                          <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ALL_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                          <Checkbox
                            checked={editForm.caseSensitive}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, caseSensitive: checked === true })}
                          />
                          Aa
                        </label>
                        <div className="ml-auto flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditRule}>Cancel</Button>
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={saveEditRule} disabled={!editForm.pattern.trim() || !editForm.category}>Save</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={rule._id}
                      className={`card-interactive flex items-center justify-between rounded-lg border px-4 py-2.5 ${rule.enabled ? "border-border/60 bg-card" : "border-border/30 opacity-50 bg-muted/20"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded-md font-mono border border-border/40">{rule.pattern}</code>
                          <span className="text-[11px] text-muted-foreground/60">
                            in {rule.matchField === "any" ? "any field" : rule.matchField}
                          </span>
                          <IconChevronRight className="size-3 text-muted-foreground/40" />
                          {(() => {
                            const color = getCategoryColor(rule.category)
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${color.bg} ${color.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                                {rule.category}
                              </span>
                            )
                          })()}
                          {rule.caseSensitive && <Badge variant="outline" className="text-[9px] px-1 py-0">Aa</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditRule(rule)}
                          title="Edit rule"
                        >
                          <IconEdit className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleRuleEnabled(rule)}
                          title={rule.enabled ? "Disable" : "Enable"}
                        >
                          {rule.enabled
                            ? <IconCheck className="size-3.5 text-primary" />
                            : <IconX className="size-3.5 text-muted-foreground" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteRule(rule._id)}
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            {rules.length > 0 && (
              <Button variant="destructive" size="sm" onClick={deleteAllRules}>
                <IconTrash className="mr-1 size-3.5" /> Delete All ({rules.length})
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowRules(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Categorization Dialog */}
      <Dialog open={showSmartCatDialog} onOpenChange={(open) => { if (!open) { setShowSmartCatDialog(false); setSmartCatData(null) } }}>
        <DialogContent className="max-w-[min(900px,calc(100vw-2rem))] flex flex-col max-h-[85vh] !grid-cols-none p-0">
          <div className="px-6 pt-6 pb-0">
            <DialogHeader>
              <DialogTitle>Apply to Similar Transactions?</DialogTitle>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground">
                  We found {smartCatData?.matches.length} other transaction{(smartCatData?.matches.length || 0) !== 1 ? "s" : ""} from <strong>&quot;{smartCatData?.merchant}&quot;</strong>. Categorize them as{" "}
                  {(() => {
                    const color = getCategoryColor(smartCatData?.category || "")
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${color.bg} ${color.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                        {smartCatData?.category}
                      </span>
                    )
                  })()}{" "}
                  too?
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>

          {smartCatData && (
            <div className="flex-1 min-h-0 flex flex-col gap-3 px-6">
              <div className="flex items-center justify-between shrink-0">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={smartCatData.selectedIds.size === smartCatData.matches.length}
                    onCheckedChange={(checked) => {
                      setSmartCatData({
                        ...smartCatData,
                        selectedIds: checked ? new Set(smartCatData.matches.map((m) => m.id)) : new Set(),
                      })
                    }}
                  />
                  Select All
                </label>
                <span className="text-xs text-muted-foreground">{smartCatData.selectedIds.size} of {smartCatData.matches.length} selected</span>
              </div>

              <div className="border rounded-xl divide-y flex-1 min-h-0 overflow-y-auto bg-card">
                {smartCatData.matches.map((match) => {
                  const matchColor = getCategoryColor(match.category)
                  return (
                    <label
                      key={match.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={smartCatData.selectedIds.has(match.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(smartCatData.selectedIds)
                          if (checked) next.add(match.id)
                          else next.delete(match.id)
                          setSmartCatData({ ...smartCatData, selectedIds: next })
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{match.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          <span className={`font-semibold tabular-nums ${match.type === "income" ? "text-primary" : ""}`}>
                            {match.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(match.amount))}
                          </span>
                          {" · "}
                          <span className="tabular-nums">
                            {new Date(match.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}
                          </span>
                          {" · "}
                          <span className={matchColor.text}>{match.category}</span>
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground shrink-0">
                <Checkbox
                  checked={smartCatCreateRule}
                  onCheckedChange={(checked) => setSmartCatCreateRule(checked === true)}
                />
                Also create a rule for future imports
              </label>
            </div>
          )}

          <div className="px-6 pb-6 pt-2 shrink-0">
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowSmartCatDialog(false); setSmartCatData(null) }}>Skip</Button>
              <Button
                onClick={applySmartCategorization}
                disabled={isSavingSmartCat || !smartCatData?.selectedIds.size}
              >
                {isSavingSmartCat ? "Applying..." : `Apply to ${smartCatData?.selectedIds.size || 0} Transaction${(smartCatData?.selectedIds.size || 0) !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function TransactionsLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-elevated rounded-xl bg-card p-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
      {/* Toolbar skeleton */}
      <div className="card-elevated rounded-xl bg-card p-3 flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-[380px]" />
        <Skeleton className="h-9 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
      {/* Table skeleton */}
      <div className="card-elevated rounded-xl bg-card overflow-hidden">
        <div className="space-y-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/20">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-2.5 w-10" />
              </div>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-3 w-16 hidden lg:block" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
