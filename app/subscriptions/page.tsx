"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  IconCreditCard,
  IconEdit,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconCalendar,
  IconCurrencyRupee,
  IconPlayerPause,
  IconPlayerPlay,
  IconSearch,
} from "@tabler/icons-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { formatINR } from "@/lib/format"
import { TransactionCategory } from "@/lib/types"
import { stagger, fadeUp } from "@/lib/motion"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MetricTile } from "@/components/metric-tile"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─── Popular Services (logo.dev domains + defaults) ───

const POPULAR_SERVICES = [
  { name: "Netflix", domain: "netflix.com", amount: 649, frequency: "monthly" as const, category: "Entertainment", color: "#E50914" },
  { name: "Spotify", domain: "spotify.com", amount: 119, frequency: "monthly" as const, category: "Entertainment", color: "#1DB954" },
  { name: "Apple Music", domain: "music.apple.com", amount: 99, frequency: "monthly" as const, category: "Entertainment", color: "#FA243C" },
  { name: "iCloud+", domain: "icloud.com", amount: 75, frequency: "monthly" as const, category: "Subscription", color: "#3693F3" },
  { name: "Google One", domain: "one.google.com", amount: 130, frequency: "monthly" as const, category: "Subscription", color: "#4285F4" },
  { name: "Amazon Prime", domain: "primevideo.com", amount: 1499, frequency: "yearly" as const, category: "Entertainment", color: "#00A8E1" },
  { name: "YouTube Premium", domain: "youtube.com", amount: 149, frequency: "monthly" as const, category: "Entertainment", color: "#FF0000" },
  { name: "Disney+ Hotstar", domain: "hotstar.com", amount: 299, frequency: "monthly" as const, category: "Entertainment", color: "#1A3068" },
  { name: "JioCinema", domain: "jiocinema.com", amount: 89, frequency: "monthly" as const, category: "Entertainment", color: "#E72E78" },
  { name: "Notion", domain: "notion.so", amount: 800, frequency: "monthly" as const, category: "Subscription", color: "#000000" },
  { name: "ChatGPT Plus", domain: "chatgpt.com", amount: 1700, frequency: "monthly" as const, category: "Subscription", color: "#74AA9C" },
  { name: "Claude Pro", domain: "claude.ai", amount: 1700, frequency: "monthly" as const, category: "Subscription", color: "#D4A574" },
  { name: "Adobe Creative Cloud", domain: "adobe.com", amount: 1675, frequency: "monthly" as const, category: "Subscription", color: "#FF0000" },
  { name: "Google Drive", domain: "drive.google.com", amount: 130, frequency: "monthly" as const, category: "Subscription", color: "#4285F4" },
  { name: "Microsoft 365", domain: "microsoft.com", amount: 489, frequency: "monthly" as const, category: "Subscription", color: "#0078D4" },
  { name: "Figma", domain: "figma.com", amount: 1050, frequency: "monthly" as const, category: "Subscription", color: "#F24E1E" },
  { name: "GitHub Pro", domain: "github.com", amount: 340, frequency: "monthly" as const, category: "Subscription", color: "#24292F" },
  { name: "LinkedIn Premium", domain: "linkedin.com", amount: 1500, frequency: "monthly" as const, category: "Subscription", color: "#0A66C2" },
]

// Build a lookup: lowercase name -> service info
const SERVICE_LOOKUP = new Map(
  POPULAR_SERVICES.map((s) => [s.name.toLowerCase(), s])
)

// Also build partial match aliases
const SERVICE_ALIASES: Record<string, string> = {
  netflix: "netflix.com",
  spotify: "spotify.com",
  "apple music": "music.apple.com",
  icloud: "icloud.com",
  "icloud+": "icloud.com",
  "google one": "one.google.com",
  "google drive": "drive.google.com",
  "amazon prime": "primevideo.com",
  prime: "primevideo.com",
  "prime video": "primevideo.com",
  youtube: "youtube.com",
  "youtube premium": "youtube.com",
  "disney+": "hotstar.com",
  "disney+ hotstar": "hotstar.com",
  hotstar: "hotstar.com",
  jiocinema: "jiocinema.com",
  notion: "notion.so",
  chatgpt: "chatgpt.com",
  "chatgpt plus": "chatgpt.com",
  openai: "chatgpt.com",
  claude: "claude.ai",
  "claude pro": "claude.ai",
  anthropic: "claude.ai",
  adobe: "adobe.com",
  "creative cloud": "adobe.com",
  microsoft: "microsoft.com",
  "microsoft 365": "microsoft.com",
  office: "microsoft.com",
  figma: "figma.com",
  github: "github.com",
  linkedin: "linkedin.com",
}

function getServiceDomain(name: string): string | null {
  const lower = name.toLowerCase().trim()
  // Exact match
  const service = SERVICE_LOOKUP.get(lower)
  if (service) return service.domain
  // Alias match
  if (SERVICE_ALIASES[lower]) return SERVICE_ALIASES[lower]
  // Partial match
  for (const [alias, domain] of Object.entries(SERVICE_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) return domain
  }
  return null
}

function getServiceColor(name: string): string {
  const lower = name.toLowerCase().trim()
  const service = SERVICE_LOOKUP.get(lower)
  if (service) return service.color
  // Hash-based color for unknown services
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash % 360)
  return `oklch(0.55 0.12 ${hue})`
}

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || "pk_ajceTXQWTCGDlDmPsAhitg"

function getLogoUrl(domain: string, size: number): string {
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=${size}&format=png`
}

function ServiceLogo({ name, size = 32 }: { name: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const domain = getServiceDomain(name)

  if (!domain || imgError) {
    // Fallback: colored initial letter
    const color = getServiceColor(name)
    const initial = name.charAt(0).toUpperCase()
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg text-white font-bold"
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={getLogoUrl(domain, size * 2)}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-contain"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  )
}

// ─── Types ───

interface Subscription {
  _id: string
  userId: string
  name: string
  amount: number
  frequency: "monthly" | "yearly" | "weekly"
  category: string
  lastCharged: string
  nextExpected: string
  status: "active" | "cancelled" | "paused"
  autoDetected: boolean
  merchantPattern?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Category badge colors ───

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Subscription: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Entertainment: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Shopping: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Utilities: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Education: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Healthcare: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Fitness: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Insurance: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Transport: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Dining: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Personal Care": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Miscellaneous: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
}

function getCategoryBadgeClass(category: string): string {
  return CATEGORY_BADGE_COLORS[category] || "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active: { label: "Active", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  paused: { label: "Paused", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  cancelled: { label: "Cancelled", class: "bg-slate-100 text-slate-500 dark:bg-slate-900/30 dark:text-slate-500 border-slate-200 dark:border-slate-800" },
}

// ─── Helpers ───

function formatDate(iso: string): string {
  if (!iso) return "--"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function daysUntil(iso: string): number {
  if (!iso) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly": return amount * (52 / 12)
    case "yearly": return amount / 12
    default: return amount
  }
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case "weekly": return "/wk"
    case "yearly": return "/yr"
    default: return "/mo"
  }
}

// Available categories for the select dropdown
const CATEGORY_OPTIONS = Object.values(TransactionCategory).filter(
  (c) => !["Salary", "Freelance", "Business", "Investment Income", "Other Income"].includes(c)
)

// ─── Blank form state ───

function blankForm() {
  return {
    name: "",
    amount: "",
    frequency: "monthly" as "monthly" | "yearly" | "weekly",
    category: "Subscription",
    nextExpected: new Date().toISOString().split("T")[0],
    lastCharged: "",
    notes: "",
  }
}

// ─── Main component ───

export default function SubscriptionsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [editTarget, setEditTarget] = useState<Subscription | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/")
  }, [authLoading, isAuthenticated, router])

  // ─── Data fetching ───

  const {
    data: subsData,
    isLoading: subsLoading,
  } = useQuery<{ success: boolean; subscriptions: Subscription[] }>({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch subscriptions")
      return res.json()
    },
    enabled: isAuthenticated,
  })

  const subscriptions = subsData?.subscriptions ?? []

  // ─── Mutations ───

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to create subscription")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      toast.success("Subscription added")
      setShowAddDialog(false)
      setForm(blankForm())
    },
    onError: (error: Error) => {
      toast.error("Failed to add subscription", { description: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to update subscription")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      toast.success("Subscription updated")
      setShowEditDialog(false)
      setEditTarget(null)
    },
    onError: (error: Error) => {
      toast.error("Failed to update", { description: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete subscription")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      toast.success("Subscription deleted")
      setShowDeleteDialog(false)
      setDeleteTarget(null)
    },
    onError: (error: Error) => {
      toast.error("Failed to delete", { description: error.message })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      const label = variables.status === "active" ? "resumed" : variables.status === "paused" ? "paused" : "cancelled"
      toast.success(`Subscription ${label}`)
    },
  })

  // ─── Handlers ───

  const handleCreate = useCallback(() => {
    const amount = parseFloat(form.amount)
    if (!form.name.trim()) { toast.error("Name is required"); return }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!form.nextExpected) { toast.error("Next expected date is required"); return }

    createMutation.mutate({
      name: form.name.trim(),
      amount,
      frequency: form.frequency,
      category: form.category,
      nextExpected: form.nextExpected,
      lastCharged: form.lastCharged || "",
      notes: form.notes || "",
      status: "active",
      autoDetected: false,
    })
  }, [form, createMutation])

  const handleEdit = useCallback(() => {
    if (!editTarget) return
    const amount = parseFloat(form.amount)
    if (!form.name.trim()) { toast.error("Name is required"); return }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount"); return }

    updateMutation.mutate({
      id: editTarget._id,
      name: form.name.trim(),
      amount,
      frequency: form.frequency,
      category: form.category,
      nextExpected: form.nextExpected,
      lastCharged: form.lastCharged,
      notes: form.notes,
    })
  }, [editTarget, form, updateMutation])

  const openEditDialog = useCallback((sub: Subscription) => {
    setEditTarget(sub)
    setForm({
      name: sub.name,
      amount: sub.amount.toString(),
      frequency: sub.frequency,
      category: sub.category,
      nextExpected: sub.nextExpected ? sub.nextExpected.split("T")[0] : "",
      lastCharged: sub.lastCharged ? sub.lastCharged.split("T")[0] : "",
      notes: sub.notes || "",
    })
    setShowEditDialog(true)
  }, [])

  const openDeleteDialog = useCallback((sub: Subscription) => {
    setDeleteTarget(sub)
    setShowDeleteDialog(true)
  }, [])

  // ─── Computed values ───

  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === "active"), [subscriptions])
  const pausedSubs = useMemo(() => subscriptions.filter((s) => s.status === "paused"), [subscriptions])
  const cancelledSubs = useMemo(() => subscriptions.filter((s) => s.status === "cancelled"), [subscriptions])

  const monthlyTotal = useMemo(
    () => activeSubs.reduce((sum, s) => sum + normalizeToMonthly(s.amount, s.frequency), 0),
    [activeSubs]
  )
  const yearlyProjection = monthlyTotal * 12

  // Filter subscriptions by search
  const filterSubs = useCallback(
    (subs: Subscription[]) => {
      if (!searchQuery.trim()) return subs
      const q = searchQuery.toLowerCase()
      return subs.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
    },
    [searchQuery]
  )

  // Upcoming renewals (within 7 days)
  const upcomingRenewals = useMemo(
    () => activeSubs.filter((s) => {
      const days = daysUntil(s.nextExpected)
      return days >= 0 && days <= 7
    }),
    [activeSubs]
  )

  // ─── Loading / Auth guards ───

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const isLoading = subsLoading

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
          title="Subscriptions"
          subtitle="Track recurring payments and subscriptions"
          actions={
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => { setForm(blankForm()); setShowAddDialog(true) }}
            >
              <IconPlus className="h-3.5 w-3.5" />
              Add
            </Button>
          }
        />
        <div className="flex flex-1 flex-col">
          {isLoading ? (
            <SubscriptionsLoadingSkeleton />
          ) : (
            <motion.div
              className="space-y-4 p-4"
              initial="hidden"
              animate="show"
              variants={stagger}
            >
              {/* ─── Stat Tiles ─── */}
              <motion.div variants={fadeUp}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="Active Subscriptions"
                    value={activeSubs.length.toString()}
                    trendLabel={pausedSubs.length > 0 ? `${pausedSubs.length} paused` : undefined}
                    icon={<IconRepeat className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Monthly Total"
                    value={formatINR(Math.round(monthlyTotal))}
                    trendLabel={`across ${activeSubs.length} subscriptions`}
                    icon={<IconCurrencyRupee className="h-5 w-5" />}
                  />
                  <MetricTile
                    label="Yearly Projection"
                    value={formatINR(Math.round(yearlyProjection))}
                    trendLabel="estimated annual spend"
                    icon={<IconCalendar className="h-5 w-5" />}
                  />
                </div>
              </motion.div>

              {/* ─── Upcoming Renewals ─── */}
              {upcomingRenewals.length > 0 && (
                <motion.div variants={fadeUp}>
                  <Card className="border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <IconCalendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Upcoming Renewals
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {upcomingRenewals.length} subscription{upcomingRenewals.length > 1 ? "s" : ""} renewing within 7 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {upcomingRenewals.map((sub) => {
                          const days = daysUntil(sub.nextExpected)
                          return (
                            <div
                              key={sub._id}
                              className="flex items-center gap-2 rounded-lg border border-amber-200/60 dark:border-amber-800/30 bg-background/80 px-3 py-2"
                            >
                              <ServiceLogo name={sub.name} size={20} />
                              <span className="text-sm font-medium">{sub.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatINR(sub.amount)}
                              </span>
                              <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-4 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── Subscriptions Table ─── */}
              <motion.div variants={fadeUp}>
                <Card className="card-elevated">
                  <CardHeader className="pb-3 px-5 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">All Subscriptions</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Manage your recurring payments
                        </CardDescription>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search subscriptions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <Tabs defaultValue="active" className="w-full">
                      <div className="px-5">
                        <TabsList className="h-8">
                          <TabsTrigger value="active" className="text-xs gap-1.5">
                            Active
                            {activeSubs.length > 0 && (
                              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[11px]">
                                {activeSubs.length}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="paused" className="text-xs gap-1.5">
                            Paused
                            {pausedSubs.length > 0 && (
                              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[11px]">
                                {pausedSubs.length}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="cancelled" className="text-xs gap-1.5">
                            Cancelled
                            {cancelledSubs.length > 0 && (
                              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[11px]">
                                {cancelledSubs.length}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="active" className="mt-0">
                        <SubscriptionTable
                          subscriptions={filterSubs(activeSubs)}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                          onToggleStatus={(sub) =>
                            toggleStatusMutation.mutate({ id: sub._id, status: "paused" })
                          }
                          toggleLabel="Pause"
                          toggleIcon={<IconPlayerPause className="h-3.5 w-3.5" />}
                          emptyMessage="No active subscriptions. Add one to get started."
                        />
                      </TabsContent>

                      <TabsContent value="paused" className="mt-0">
                        <SubscriptionTable
                          subscriptions={filterSubs(pausedSubs)}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                          onToggleStatus={(sub) =>
                            toggleStatusMutation.mutate({ id: sub._id, status: "active" })
                          }
                          toggleLabel="Resume"
                          toggleIcon={<IconPlayerPlay className="h-3.5 w-3.5" />}
                          emptyMessage="No paused subscriptions."
                        />
                      </TabsContent>

                      <TabsContent value="cancelled" className="mt-0">
                        <SubscriptionTable
                          subscriptions={filterSubs(cancelledSubs)}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                          onToggleStatus={(sub) =>
                            toggleStatusMutation.mutate({ id: sub._id, status: "active" })
                          }
                          toggleLabel="Reactivate"
                          toggleIcon={<IconPlayerPlay className="h-3.5 w-3.5" />}
                          emptyMessage="No cancelled subscriptions."
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ─── Summary by Category ─── */}
              {activeSubs.length > 0 && (
                <motion.div variants={fadeUp}>
                  <Card className="card-elevated">
                    <CardHeader className="pb-3 px-5 pt-4">
                      <CardTitle className="text-sm font-semibold">Spend by Category</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Monthly equivalent breakdown of active subscriptions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="space-y-2.5">
                        {Object.entries(
                          activeSubs.reduce<Record<string, { monthly: number; count: number }>>((acc, sub) => {
                            const cat = sub.category || "Uncategorized"
                            if (!acc[cat]) acc[cat] = { monthly: 0, count: 0 }
                            acc[cat].monthly += normalizeToMonthly(sub.amount, sub.frequency)
                            acc[cat].count += 1
                            return acc
                          }, {})
                        )
                          .sort((a, b) => b[1].monthly - a[1].monthly)
                          .map(([cat, { monthly, count }]) => {
                            const pct = monthlyTotal > 0 ? (monthly / monthlyTotal) * 100 : 0
                            return (
                              <div key={cat} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-4 border-0 ${getCategoryBadgeClass(cat)}`}>
                                      {cat}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{count} sub{count > 1 ? "s" : ""}</span>
                                  </div>
                                  <span className="font-semibold tabular-nums text-sm">
                                    {formatINR(Math.round(monthly))}
                                    <span className="text-muted-foreground font-normal text-xs">/mo</span>
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </SidebarInset>

      {/* ─── Add Subscription Dialog ─── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setForm(blankForm()) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subscription</DialogTitle>
            <DialogDescription>Track a new recurring payment.</DialogDescription>
          </DialogHeader>
          <SubscriptionForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setForm(blankForm()) }} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Subscription Dialog ─── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setEditTarget(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>Update details for {editTarget?.name}.</DialogDescription>
          </DialogHeader>
          <SubscriptionForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditTarget(null) }} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeleteTarget(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteTarget(null) }} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

// ─── Subscription Form (shared between Add & Edit) ───

interface SubscriptionFormProps {
  form: ReturnType<typeof blankForm>
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof blankForm>>>
}

function SubscriptionForm({ form, setForm }: SubscriptionFormProps) {
  const handleQuickSelect = (service: (typeof POPULAR_SERVICES)[number]) => {
    setForm((prev) => ({
      ...prev,
      name: service.name,
      amount: service.amount.toString(),
      frequency: service.frequency,
      category: service.category,
    }))
  }

  return (
    <div className="space-y-4 py-2">
      {/* Quick-select popular services */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Add</Label>
        <Select
          value=""
          onValueChange={(val) => {
            const svc = POPULAR_SERVICES.find((s) => s.name === val)
            if (svc) handleQuickSelect(svc)
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose a popular service..." />
          </SelectTrigger>
          <SelectContent>
            {POPULAR_SERVICES.map((svc) => (
              <SelectItem key={svc.name} value={svc.name}>
                <span className="flex items-center gap-2">
                  <ServiceLogo name={svc.name} size={18} />
                  <span>{svc.name}</span>
                  <span className="text-muted-foreground ml-auto">{formatINR(svc.amount)}/{svc.frequency === "yearly" ? "yr" : "mo"}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="sub-name">Name</Label>
          <div className="flex gap-2 items-center">
            {form.name && <ServiceLogo name={form.name} size={28} />}
            <Input
              id="sub-name"
              placeholder="e.g. Netflix, Spotify"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-amount">Amount (INR)</Label>
          <Input
            id="sub-amount"
            type="number"
            placeholder="499"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={form.frequency}
            onValueChange={(val) => setForm((prev) => ({ ...prev, frequency: val as "monthly" | "yearly" | "weekly" }))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={form.category}
            onValueChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-next">Next Expected</Label>
          <Input
            id="sub-next"
            type="date"
            value={form.nextExpected}
            onChange={(e) => setForm((prev) => ({ ...prev, nextExpected: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-last">Last Charged</Label>
          <Input
            id="sub-last"
            type="date"
            value={form.lastCharged}
            onChange={(e) => setForm((prev) => ({ ...prev, lastCharged: e.target.value }))}
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="sub-notes">Notes (optional)</Label>
          <Input
            id="sub-notes"
            placeholder="Family plan, shared with..."
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Subscription Table ───

interface SubscriptionTableProps {
  subscriptions: Subscription[]
  onEdit: (sub: Subscription) => void
  onDelete: (sub: Subscription) => void
  onToggleStatus: (sub: Subscription) => void
  toggleLabel: string
  toggleIcon: React.ReactNode
  emptyMessage: string
}

function SubscriptionTable({
  subscriptions,
  onEdit,
  onDelete,
  onToggleStatus,
  toggleLabel,
  toggleIcon,
  emptyMessage,
}: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40 hover:bg-transparent">
            <TableHead className="text-[11px] uppercase tracking-wider font-medium">Name</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider font-medium">Amount</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-medium hidden sm:table-cell">Frequency</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-medium hidden md:table-cell">Category</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-medium hidden lg:table-cell">Last Charged</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-medium">Next Expected</TableHead>
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => {
            const days = daysUntil(sub.nextExpected)
            const isUpcoming = days >= 0 && days <= 3
            const isOverdue = days < 0

            return (
              <TableRow
                key={sub._id}
                className="h-[52px] border-border/30 group transition-colors hover:bg-muted/30"
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ServiceLogo name={sub.name} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sub.name}</p>
                      {sub.notes && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{sub.notes}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatINR(sub.amount)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{frequencyLabel(sub.frequency)}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground capitalize">{sub.frequency}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-4 border-0 ${getCategoryBadgeClass(sub.category)}`}>
                    {sub.category}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(sub.lastCharged)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs tabular-nums ${isOverdue ? "text-destructive font-medium" : isUpcoming ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                      {formatDate(sub.nextExpected)}
                    </span>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-[11px] px-1 py-0 h-4">Overdue</Badge>
                    )}
                    {isUpcoming && !isOverdue && (
                      <Badge variant="outline" className="text-[11px] px-1 py-0 h-4 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400">
                        {days === 0 ? "Today" : days === 1 ? "1d" : `${days}d`}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => onToggleStatus(sub)}
                      title={toggleLabel}
                    >
                      {toggleIcon}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(sub)}
                      title="Edit"
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-destructive"
                      onClick={() => onDelete(sub)}
                      title="Delete"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Loading Skeleton ───

function SubscriptionsLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  )
}
