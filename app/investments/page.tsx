"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowDown,
  IconArrowUp,
  IconChartBar,
  IconChartLine,
  IconCoin,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconReplace,
  IconTrash,
  IconTrendingUp,
  IconUpload,
  IconWallet,
} from "@tabler/icons-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MetricTile } from "@/components/metric-tile"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { StockHolding, StockQuote, MutualFundHolding, MutualFundTransaction, SipEntry, StockTransaction } from "@/lib/sips-stocks"
import { calculateInvestmentXIRR, calculateCAGR } from "@/lib/xirr"
import { isGrowwTransaction } from "@/lib/groww-parser"

// ─── Helpers ───

function fmt(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function fmtPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtCompact(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

function cleanNum(val: string | undefined): string {
  return (val || "0").replace(/,/g, "").trim()
}

const COLORS = {
  indigo: "#6366f1",
  amber: "#f59e0b",
  emerald: "#10b981",
  red: "#ef4444",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  sky: "#0ea5e9",
  lime: "#84cc16",
}

const PIE_COLORS = [
  COLORS.indigo, COLORS.amber, COLORS.emerald, COLORS.red,
  COLORS.violet, COLORS.cyan, COLORS.orange, COLORS.pink,
]

const ISIN_TICKER_MAP: Record<string, { symbol: string; exchange: string }> = {
  "INE263A01024": { symbol: "BEL", exchange: "NSE" },
  "INE758T01015": { symbol: "ETERNAL", exchange: "NSE" },
  "INE04I401011": { symbol: "KPITTECH", exchange: "NSE" },
  "INF204KB14I2": { symbol: "NIFTYBEES", exchange: "BSE" },
  "INE752E01010": { symbol: "POWERGRID", exchange: "NSE" },
  "INE002A01018": { symbol: "RELIANCE", exchange: "NSE" },
  "INE775A01035": { symbol: "MOTHERSON", exchange: "BSE" },
  "INE044A01036": { symbol: "SUNPHARMA", exchange: "NSE" },
  "INE733E01010": { symbol: "NTPC", exchange: "BSE" },
  "INE160A01022": { symbol: "PNB", exchange: "BSE" },
  "INE528G01035": { symbol: "YESBANK", exchange: "NSE" },
  "INE399K01017": { symbol: "RTNPOWER", exchange: "BSE" },
  "INF204KB17I5": { symbol: "GOLDBEES", exchange: "BSE" },
  "INF179KC1981": { symbol: "HDFCGOLD", exchange: "BSE" },
}

// ─── ReplaceToggle (outside component to avoid remount) ───

function ReplaceToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-border" />
      <IconReplace className="size-3" />
      {label}
    </label>
  )
}

// ─── Custom Tooltip ───

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <div className="text-sm font-medium">{d.payload.name}</div>
      <div className="text-xs text-muted-foreground">{fmt(d.value)}</div>
    </div>
  )
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <div className="text-sm font-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-xs text-muted-foreground">
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function InvestmentsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  // Data state
  const [stocks, setStocks] = useState<StockHolding[]>([])
  const [stockTxns, setStockTxns] = useState<StockTransaction[]>([])
  const [mutualFunds, setMutualFunds] = useState<MutualFundHolding[]>([])
  const [mutualFundTxns, setMutualFundTxns] = useState<MutualFundTransaction[]>([])
  const [sips, setSips] = useState<SipEntry[]>([])
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Import & feedback messages
  const [stockImportMsg, setStockImportMsg] = useState<string | null>(null)
  const [stockTxnImportMsg, setStockTxnImportMsg] = useState<string | null>(null)
  const [fundImportMsg, setFundImportMsg] = useState<string | null>(null)
  const [fundTxnImportMsg, setFundTxnImportMsg] = useState<string | null>(null)
  const [sipImportMsg, setSipImportMsg] = useState<string | null>(null)
  const [crudError, setCrudError] = useState<string | null>(null)

  // Replace-on-import toggles
  const [replaceStocks, setReplaceStocks] = useState(true)
  const [replaceStockTxns, setReplaceStockTxns] = useState(true)
  const [replaceFunds, setReplaceFunds] = useState(true)
  const [replaceFundTxns, setReplaceFundTxns] = useState(true)
  const [replaceSips, setReplaceSips] = useState(true)

  // Edit dialogs
  const [editingStock, setEditingStock] = useState<StockHolding | null>(null)
  const [editStockForm, setEditStockForm] = useState({ symbol: "", exchange: "", shares: "", averageCost: "", expectedAnnualReturn: "" })
  const [editingFund, setEditingFund] = useState<MutualFundHolding | null>(null)
  const [editFundForm, setEditFundForm] = useState({ schemeName: "", amc: "", category: "", units: "", investedValue: "", currentValue: "" })
  const [editingSip, setEditingSip] = useState<SipEntry | null>(null)
  const [editSipForm, setEditSipForm] = useState({ name: "", provider: "", monthlyAmount: "", startDate: "", expectedAnnualReturn: "", status: "active" as string })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Add stock form
  const [showAddStock, setShowAddStock] = useState(false)
  const [stockForm, setStockForm] = useState({ symbol: "", exchange: "NSE", shares: "", averageCost: "", expectedAnnualReturn: "" })

  // Add SIP form
  const [showAddSip, setShowAddSip] = useState(false)
  const [sipForm, setSipForm] = useState({ name: "", provider: "", monthlyAmount: "", startDate: "", expectedAnnualReturn: "", status: "active" })

  // SIP projection & trailing returns
  const [trailingReturns, setTrailingReturns] = useState<Record<string, { period: string; annualizedReturn: number }[]>>({})
  const [isLoadingReturns, setIsLoadingReturns] = useState(false)

  // SIP deduction matching
  const [sipMatches, setSipMatches] = useState<Array<{ sipName: string; sipAmount: number; bankTxn: { date: string; description: string; amount: number }; dateProximity: number }>>([])
  const [unmatchedGrowwTxns, setUnmatchedGrowwTxns] = useState<Array<{ date: string; description: string; amount: number }>>([])
  const [bankTxnsForMatching, setBankTxnsForMatching] = useState<Array<{ date: string; description: string; amount: number }>>([])
  const [hasFetchedBankTxns, setHasFetchedBankTxns] = useState(false)

  // ─── CSV Parser ───

  const parseCsv = (text: string) => {
    const rows: string[][] = []
    let current = ""
    let row: string[] = []
    let inQuotes = false
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      const next = text[i + 1]
      if (char === '"') {
        if (inQuotes && next === '"') { current += '"'; i += 1 } else { inQuotes = !inQuotes }
        continue
      }
      if (char === "," && !inQuotes) { row.push(current); current = ""; continue }
      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1
        row.push(current)
        if (row.some((cell) => cell.trim() !== "")) rows.push(row)
        row = []; current = ""; continue
      }
      current += char
    }
    if (current.length || row.length) {
      row.push(current)
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
    }
    return rows
  }

  const normalizeHeaders = (headers: string[]) => headers.map((h) => h.trim().toLowerCase())

  const mapCsvRows = (text: string) => {
    const rows = parseCsv(text)
    if (rows.length < 2) return { headers: [] as string[], items: [] as Record<string, string>[] }
    const headers = normalizeHeaders(rows[0])
    const items = rows.slice(1).map((row) => {
      const item: Record<string, string> = {}
      headers.forEach((header, index) => { item[header] = row[index] ? row[index].trim() : "" })
      return item
    })
    return { headers, items: items.filter((item) => Object.values(item).some((v) => v !== "")) }
  }

  // ─── Stock Import (Holdings) ───

  const handleImportStocks = async (file?: File | null) => {
    if (!file) return
    setStockImportMsg(null)
    try {
    const text = await file.text()
    const { headers, items } = mapCsvRows(text)

    const isOrderHistory = headers.includes("stock name") && headers.includes("symbol") && headers.includes("order status")
    const isGrowwHoldings = headers.includes("stock name") && headers.includes("average buy price") && !headers.includes("symbol")

    let payload: Record<string, unknown>[] = []

    if (isOrderHistory) {
      const executed = items.filter((item) => (item["order status"] || "").toLowerCase() === "executed")
      // Build dynamic ISIN→ticker mapping from order history data
      executed.forEach((item) => {
        const isin = (item.isin || "").trim()
        const sym = (item.symbol || "").trim().toUpperCase()
        const ex = (item.exchange || "NSE").trim()
        if (isin && sym && !ISIN_TICKER_MAP[isin]) {
          ISIN_TICKER_MAP[isin] = { symbol: sym, exchange: ex }
        }
      })
      const map = new Map<string, { symbol: string; exchange: string; buyQty: number; buyValue: number; sellQty: number }>()
      executed.forEach((item) => {
        const symbol = (item.symbol || "").trim().toUpperCase()
        const exchange = (item.exchange || "NSE").trim()
        const type = (item.type || "").toUpperCase()
        const quantity = Number(cleanNum(item.quantity))
        const value = Number(cleanNum(item.value))
        if (!symbol || !Number.isFinite(quantity) || !Number.isFinite(value)) return
        const entry = map.get(symbol) || { symbol, exchange, buyQty: 0, buyValue: 0, sellQty: 0 }
        if (type === "BUY") { entry.buyQty += quantity; entry.buyValue += value }
        else if (type === "SELL") { entry.sellQty += quantity }
        map.set(symbol, entry)
      })
      payload = Array.from(map.values())
        .map((entry) => {
          const netShares = entry.buyQty - entry.sellQty
          if (netShares <= 0 || entry.buyQty <= 0) return null
          return { symbol: entry.symbol, exchange: entry.exchange, shares: netShares, averageCost: Math.round(entry.buyValue / entry.buyQty * 100) / 100, expectedAnnualReturn: "" }
        })
        .filter(Boolean) as Record<string, unknown>[]
    } else if (isGrowwHoldings) {
      payload = items.map((item) => {
        const isin = (item.isin || "").trim()
        const mapped = ISIN_TICKER_MAP[isin]
        return {
          symbol: mapped?.symbol || (item["stock name"] || "").trim().toUpperCase(),
          exchange: mapped?.exchange || "NSE",
          shares: cleanNum(item.quantity),
          averageCost: cleanNum(item["average buy price"]),
          expectedAnnualReturn: "",
        }
      })
    } else {
      const required = ["symbol", "exchange", "shares", "averagecost"]
      const missing = required.filter((f) => !headers.includes(f))
      if (missing.length) {
        setStockImportMsg(`Unrecognized CSV. Missing: ${missing.join(", ")}. Supported: Groww Order History, Groww Holdings Statement, or custom CSV.`)
        return
      }
      payload = items.map((item) => ({
        symbol: item.symbol, exchange: item.exchange, shares: cleanNum(item.shares),
        averageCost: cleanNum(item.averagecost), expectedAnnualReturn: item.expectedannualreturn || "",
      }))
    }

    if (!payload.length) { setStockImportMsg("No valid stock rows found."); return }

    const response = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, replaceAll: replaceStocks }),
    })
    const data = await response.json()
    if (response.ok && data.success) {
      setStockImportMsg(`${replaceStocks ? "Replaced" : "Added"} ${data.insertedCount} stock(s).${isGrowwHoldings ? " Ticker symbols resolved via ISIN mapping. Edit any unresolved symbols for live quotes." : ""}`)
      loadAll()
    } else {
      setStockImportMsg(data.message || "Failed to import stocks.")
    }
    } catch (err) { setStockImportMsg("Error importing stocks. Check the CSV format.") }
  }

  // ─── Stock Transaction Import ───

  const handleImportStockTxns = async (file?: File | null) => {
    if (!file) return
    setStockTxnImportMsg(null)
    try {
    const text = await file.text()
    const { headers, items } = mapCsvRows(text)

    // Detect Groww Stock Order History format
    const isGrowwOrderHistory = headers.includes("stock name") && headers.includes("symbol") && headers.includes("type") && headers.includes("order status")

    if (!isGrowwOrderHistory) {
      const required = ["symbol", "type", "quantity", "value"]
      const missing = required.filter((f) => !headers.includes(f))
      if (missing.length) {
        setStockTxnImportMsg(`Unrecognized CSV. Missing: ${missing.join(", ")}. Supported: Groww Stock Order History.`)
        return
      }
    }

    const executed = isGrowwOrderHistory
      ? items.filter((item) => (item["order status"] || "").toLowerCase() === "executed")
      : items

    const payload = executed.map((item) => ({
      stockName: item["stock name"] || item.stockname || "",
      symbol: (item.symbol || "").trim().toUpperCase(),
      isin: item.isin || "",
      type: (item.type || "").trim().toUpperCase(),
      quantity: cleanNum(item.quantity),
      value: cleanNum(item.value),
      exchange: item.exchange || "NSE",
      executionDate: item["execution date and time"] || item.executiondate || item.date || "",
      orderStatus: item["order status"] || "Executed",
    })).filter((item) => item.symbol && item.type && Number(item.quantity) > 0)

    if (!payload.length) { setStockTxnImportMsg("No valid transaction rows found."); return }

    // Also update holdings from order history (net positions)
    // Enrich ISIN map
    executed.forEach((item) => {
      const isin = (item.isin || "").trim()
      const sym = (item.symbol || "").trim().toUpperCase()
      const ex = (item.exchange || "NSE").trim()
      if (isin && sym && !ISIN_TICKER_MAP[isin]) {
        ISIN_TICKER_MAP[isin] = { symbol: sym, exchange: ex }
      }
    })

    const response = await fetch("/api/stocks/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, replaceAll: replaceStockTxns }),
    })
    const data = await response.json()
    if (response.ok && data.success) {
      setStockTxnImportMsg(`${replaceStockTxns ? "Replaced" : "Added"} ${data.insertedCount} stock transaction(s).`)
      loadAll()
    } else {
      setStockTxnImportMsg(data.message || "Failed to import stock transactions.")
    }
    } catch (err) { setStockTxnImportMsg("Error importing stock transactions. Check the CSV format.") }
  }

  // ─── Mutual Fund Import ───

  const handleImportFunds = async (file?: File | null) => {
    if (!file) return
    setFundImportMsg(null)
    try {
    const text = await file.text()
    const { headers, items } = mapCsvRows(text)
    const required = ["scheme name", "units", "invested value", "current value"]
    const missing = required.filter((f) => !headers.includes(f))
    if (missing.length) {
      setFundImportMsg(`Missing columns: ${missing.join(", ")}. Expected Groww Mutual Funds Holdings CSV.`)
      return
    }

    const payload = items
      .filter((item) => (item["scheme name"] || "").trim() !== "")
      .map((item) => ({
        schemeName: item["scheme name"], amc: item.amc || "", category: item.category || "",
        subCategory: item["sub-category"] || item.subcategory || "",
        folioNumber: item["folio no."] || item["folio number"] || "",
        source: item.source || "", units: cleanNum(item.units),
        investedValue: cleanNum(item["invested value"]), currentValue: cleanNum(item["current value"]),
        returns: cleanNum(item.returns), xirr: item.xirr || "",
      }))

    if (!payload.length) { setFundImportMsg("No valid fund rows found."); return }

    const response = await fetch("/api/mutual-funds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, replaceAll: replaceFunds }),
    })
    const data = await response.json()
    if (response.ok && data.success) {
      setFundImportMsg(`${replaceFunds ? "Replaced" : "Added"} ${data.insertedCount} fund(s).`)
      loadAll()
    } else {
      setFundImportMsg(data.message || "Failed to import mutual funds.")
    }
    } catch (err) { setFundImportMsg("Error importing mutual funds. Check the CSV format.") }
  }

  // ─── MF Transaction Import ───

  const handleImportFundTxns = async (file?: File | null) => {
    if (!file) return
    setFundTxnImportMsg(null)
    try {
    const text = await file.text()
    const { headers, items } = mapCsvRows(text)
    const required = ["scheme name", "transaction type", "amount", "date"]
    const missing = required.filter((f) => !headers.includes(f))
    if (missing.length) {
      setFundTxnImportMsg(`Missing columns: ${missing.join(", ")}. Expected Groww MF Order History CSV.`)
      return
    }
    const payload = items
      .filter((item) => (item["scheme name"] || "").trim() !== "")
      .map((item) => ({
        schemeName: item["scheme name"], transactionType: item["transaction type"],
        units: cleanNum(item.units), nav: cleanNum(item.nav), amount: cleanNum(item.amount), date: item.date,
      }))
    if (!payload.length) { setFundTxnImportMsg("No valid rows found."); return }

    const response = await fetch("/api/mutual-funds/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, replaceAll: replaceFundTxns }),
    })
    const data = await response.json()
    if (response.ok && data.success) {
      setFundTxnImportMsg(`${replaceFundTxns ? "Replaced" : "Added"} ${data.insertedCount} transaction(s).`)
      loadAll()
    } else {
      setFundTxnImportMsg(data.message || "Failed to import transactions.")
    }
    } catch (err) { setFundTxnImportMsg("Error importing fund transactions. Check the CSV format.") }
  }

  // ─── SIP Import (auto-detect from MF Order History) ───

  const handleImportSips = async (file?: File | null) => {
    if (!file) return
    setSipImportMsg(null)
    try {
    const text = await file.text()
    const { headers, items } = mapCsvRows(text)

    const hasMfOrderCols = headers.includes("scheme name") && headers.includes("transaction type") && headers.includes("amount") && headers.includes("date")
    if (!hasMfOrderCols) {
      const required = ["name", "provider", "monthlyamount", "startdate"]
      const missing = required.filter((f) => !headers.includes(f))
      if (missing.length) {
        setSipImportMsg(`Unrecognized CSV. Upload either Groww MF Order History (auto-detects SIPs) or custom CSV with: name, provider, monthlyAmount, startDate.`)
        return
      }
      const payload = items.map((item) => ({
        name: item.name, provider: item.provider, monthlyAmount: cleanNum(item.monthlyamount),
        startDate: item.startdate, expectedAnnualReturn: item.expectedannualreturn || "",
        status: item.status || "active",
      }))
      if (!payload.length) { setSipImportMsg("No valid SIP rows found."); return }
      const response = await fetch("/api/sips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, replaceAll: replaceSips }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSipImportMsg(`${replaceSips ? "Replaced" : "Added"} ${data.insertedCount} SIP(s).`)
        loadAll()
      } else {
        setSipImportMsg(data.message || "Failed to import SIPs.")
      }
      return
    }

    const purchases = items.filter((item) => (item["transaction type"] || "").toUpperCase() === "PURCHASE")
    const schemeMap = new Map<string, { amounts: number[]; dates: string[] }>()
    purchases.forEach((item) => {
      const name = (item["scheme name"] || "").trim()
      if (!name) return
      const entry = schemeMap.get(name) || { amounts: [], dates: [] }
      entry.amounts.push(Number(cleanNum(item.amount)))
      entry.dates.push(item.date || "")
      schemeMap.set(name, entry)
    })

    const sipPayload: Record<string, unknown>[] = []
    schemeMap.forEach((entry, schemeName) => {
      if (entry.amounts.length < 2) return
      const avgAmount = entry.amounts.reduce((a, b) => a + b, 0) / entry.amounts.length
      const roundedAmount = Math.round(avgAmount / 100) * 100 || Math.round(avgAmount)
      const sortedDates = [...entry.dates].sort()
      sipPayload.push({
        name: schemeName, provider: "Groww", monthlyAmount: roundedAmount,
        startDate: sortedDates[0] || "", expectedAnnualReturn: "", status: "active",
      })
    })

    if (!sipPayload.length) {
      setSipImportMsg("No recurring SIP patterns found. Need 2+ PURCHASE transactions per scheme.")
      return
    }

    const response = await fetch("/api/sips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: sipPayload, replaceAll: replaceSips }),
    })
    const data = await response.json()
    if (response.ok && data.success) {
      setSipImportMsg(`Detected and ${replaceSips ? "replaced" : "added"} ${data.insertedCount} SIP(s) from order history.`)
      loadAll()
    } else {
      setSipImportMsg(data.message || "Failed to import SIPs.")
    }
    } catch (err) { setSipImportMsg("Error importing SIPs. Check the CSV format.") }
  }

  // ─── Auth & Data Loading ───

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [authLoading, isAuthenticated, router])

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [stockRes, stockTxnRes, fundRes, fundTxnRes, sipRes] = await Promise.all([
        fetch("/api/stocks"),
        fetch("/api/stocks/transactions"),
        fetch("/api/mutual-funds"),
        fetch("/api/mutual-funds/transactions"),
        fetch("/api/sips"),
      ])
      const [stockData, stockTxnData, fundData, fundTxnData, sipData] = await Promise.all([
        stockRes.json(), stockTxnRes.json(), fundRes.json(), fundTxnRes.json(), sipRes.json(),
      ])
      setStocks(stockData.items || [])
      setStockTxns(stockTxnData.items || [])
      setMutualFunds(fundData.items || [])
      setMutualFundTxns(fundTxnData.items || [])
      setSips(sipData.items || [])
    } catch (error) {
      console.error("Failed to load investments:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshQuotes = async (holdings: StockHolding[]) => {
    if (!holdings.length) { setQuotes({}); return }
    setIsRefreshing(true)
    try {
      const symbols = holdings.map((h) => h.symbol).join(",")
      const response = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(symbols)}`)
      const data = await response.json()
      if (data.success && data.quotes) {
        const nextQuotes: Record<string, StockQuote> = {}
        Object.entries(data.quotes).forEach(([symbol, quote]) => {
          const q = quote as { current: number; change: number; changePercent: number }
          nextQuotes[symbol] = { symbol, ...q }
        })
        setQuotes(nextQuotes)
      }
    } catch (error) {
      console.error("Failed to refresh quotes:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => { if (isAuthenticated) loadAll() }, [isAuthenticated])
  useEffect(() => { if (stocks.length) refreshQuotes(stocks) }, [stocks])

  // Fetch bank transactions for SIP matching
  useEffect(() => {
    if (!isAuthenticated || hasFetchedBankTxns) return
    const fetchBankTxns = async () => {
      try {
        const res = await fetch("/api/transactions?limit=500")
        const data = await res.json()
        if (data.success && data.transactions) {
          const txns = data.transactions
            .filter((t: { description: string; amount: number; type: string }) =>
              t.type === "expense" && isGrowwTransaction(t.description)
            )
            .map((t: { date: string; description: string; amount: number }) => ({
              date: t.date,
              description: t.description,
              amount: Math.abs(t.amount),
            }))
          setBankTxnsForMatching(txns)
        }
        setHasFetchedBankTxns(true)
      } catch {
        setHasFetchedBankTxns(true)
      }
    }
    fetchBankTxns()
  }, [isAuthenticated, hasFetchedBankTxns])

  // Match SIP deductions when both SIPs and bank transactions are loaded
  useEffect(() => {
    if (!sips.length || !bankTxnsForMatching.length) return
    const activeSips = sips.filter((s) => s.status === "active")
    const matched: typeof sipMatches = []
    const usedIndices = new Set<number>()

    for (const sip of activeSips) {
      const sipStart = new Date(sip.startDate)
      if (isNaN(sipStart.getTime())) continue
      const sipDay = sipStart.getDate()

      for (let i = 0; i < bankTxnsForMatching.length; i++) {
        if (usedIndices.has(i)) continue
        const txn = bankTxnsForMatching[i]
        const txnDate = new Date(txn.date)
        if (isNaN(txnDate.getTime())) continue
        const dayDiff = Math.abs(txnDate.getDate() - sipDay)
        const amountMatch = Math.abs(txn.amount - sip.monthlyAmount) < sip.monthlyAmount * 0.15
        if (dayDiff <= 3 && amountMatch) {
          usedIndices.add(i)
          matched.push({ sipName: sip.name, sipAmount: sip.monthlyAmount, bankTxn: txn, dateProximity: dayDiff })
        }
      }
    }
    setSipMatches(matched)
    setUnmatchedGrowwTxns(bankTxnsForMatching.filter((_, i) => !usedIndices.has(i)))
  }, [sips, bankTxnsForMatching])

  // ─── Edit Handlers ───

  const openEditStock = (s: StockHolding) => {
    setEditingStock(s)
    setEditStockForm({ symbol: s.symbol, exchange: s.exchange, shares: s.shares.toString(), averageCost: s.averageCost.toString(), expectedAnnualReturn: s.expectedAnnualReturn?.toString() || "" })
  }
  const saveEditStock = async () => {
    if (!editingStock?._id) return
    setIsSavingEdit(true)
    setCrudError(null)
    try {
      const res = await fetch(`/api/stocks?id=${editingStock._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: editStockForm.symbol, exchange: editStockForm.exchange, shares: editStockForm.shares, averageCost: editStockForm.averageCost, expectedAnnualReturn: editStockForm.expectedAnnualReturn || null }) })
      if (res.ok) { setEditingStock(null); loadAll() }
      else { const d = await res.json().catch(() => null); setCrudError(d?.message || "Failed to update stock.") }
    } catch { setCrudError("Network error updating stock.") }
    finally { setIsSavingEdit(false) }
  }

  const openEditFund = (f: MutualFundHolding) => {
    setEditingFund(f)
    setEditFundForm({ schemeName: f.schemeName, amc: f.amc || "", category: f.category || "", units: f.units.toString(), investedValue: f.investedValue.toString(), currentValue: f.currentValue.toString() })
  }
  const saveEditFund = async () => {
    if (!editingFund?._id) return
    setIsSavingEdit(true)
    setCrudError(null)
    try {
      const res = await fetch(`/api/mutual-funds?id=${editingFund._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemeName: editFundForm.schemeName, amc: editFundForm.amc, category: editFundForm.category, units: editFundForm.units, investedValue: editFundForm.investedValue, currentValue: editFundForm.currentValue }) })
      if (res.ok) { setEditingFund(null); loadAll() }
      else { const d = await res.json().catch(() => null); setCrudError(d?.message || "Failed to update fund.") }
    } catch { setCrudError("Network error updating fund.") }
    finally { setIsSavingEdit(false) }
  }

  const openEditSip = (s: SipEntry) => {
    setEditingSip(s)
    setEditSipForm({ name: s.name, provider: s.provider, monthlyAmount: s.monthlyAmount.toString(), startDate: s.startDate, expectedAnnualReturn: s.expectedAnnualReturn?.toString() || "", status: s.status })
  }
  const saveEditSip = async () => {
    if (!editingSip?._id) return
    setIsSavingEdit(true)
    setCrudError(null)
    try {
      const res = await fetch(`/api/sips?id=${editingSip._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editSipForm.name, provider: editSipForm.provider, monthlyAmount: editSipForm.monthlyAmount, startDate: editSipForm.startDate, expectedAnnualReturn: editSipForm.expectedAnnualReturn || null, status: editSipForm.status }) })
      if (res.ok) { setEditingSip(null); loadAll() }
      else { const d = await res.json().catch(() => null); setCrudError(d?.message || "Failed to update SIP.") }
    } catch { setCrudError("Network error updating SIP.") }
    finally { setIsSavingEdit(false) }
  }

  // ─── CRUD ───

  const handleAddStock = async () => {
    setCrudError(null)
    try {
      const res = await fetch("/api/stocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stockForm) })
      if (res.ok) { setStockForm({ symbol: "", exchange: "NSE", shares: "", averageCost: "", expectedAnnualReturn: "" }); setShowAddStock(false); loadAll() }
      else { const d = await res.json().catch(() => null); setCrudError(d?.message || "Failed to add stock. Check all fields are valid.") }
    } catch { setCrudError("Network error adding stock.") }
  }
  const handleDeleteStock = async (id?: string) => {
    if (!id) return
    try { await fetch(`/api/stocks?id=${id}`, { method: "DELETE" }); loadAll() }
    catch { setCrudError("Failed to delete stock.") }
  }
  const handleDeleteFund = async (id?: string) => {
    if (!id) return
    try { await fetch(`/api/mutual-funds?id=${id}`, { method: "DELETE" }); loadAll() }
    catch { setCrudError("Failed to delete fund.") }
  }
  const handleDeleteSip = async (id?: string) => {
    if (!id) return
    try { await fetch(`/api/sips?id=${id}`, { method: "DELETE" }); loadAll() }
    catch { setCrudError("Failed to delete SIP.") }
  }

  const handleAddSip = async () => {
    setCrudError(null)
    try {
      const res = await fetch("/api/sips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sipForm) })
      if (res.ok) { setSipForm({ name: "", provider: "", monthlyAmount: "", startDate: "", expectedAnnualReturn: "", status: "active" }); setShowAddSip(false); loadAll() }
      else { const d = await res.json().catch(() => null); setCrudError(d?.message || "Failed to add SIP. Check all fields are valid.") }
    } catch { setCrudError("Network error adding SIP.") }
  }

  // ─── Computed Totals ───

  const stockTotals = useMemo(() => {
    const totalInvested = stocks.reduce((sum, s) => sum + s.shares * s.averageCost, 0)
    const totalValue = stocks.reduce((sum, s) => {
      const q = quotes[s.symbol]
      return sum + s.shares * (q?.current || s.averageCost)
    }, 0)
    const totalPL = totalValue - totalInvested
    const plPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0
    return { totalInvested, totalValue, totalPL, plPercent }
  }, [stocks, quotes])

  const fundTotals = useMemo(() => {
    const invested = mutualFunds.reduce((sum, f) => sum + f.investedValue, 0)
    const current = mutualFunds.reduce((sum, f) => sum + f.currentValue, 0)
    const returns = current - invested
    const plPercent = invested > 0 ? (returns / invested) * 100 : 0
    return { invested, current, returns, plPercent }
  }, [mutualFunds])

  const sipTotals = useMemo(() => {
    const activeSips = sips.filter((s) => s.status === "active")
    const monthlyTotal = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0)
    const yearlyTotal = monthlyTotal * 12
    return { active: activeSips.length, total: sips.length, monthlyTotal, yearlyTotal }
  }, [sips])

  const portfolioTotal = useMemo(() => {
    const invested = stockTotals.totalInvested + fundTotals.invested
    const current = stockTotals.totalValue + fundTotals.current
    const pl = current - invested
    const plPercent = invested > 0 ? (pl / invested) * 100 : 0
    return { invested, current, pl, plPercent }
  }, [stockTotals, fundTotals])

  const dayChange = useMemo(() => {
    let totalChange = 0
    stocks.forEach((s) => {
      const q = quotes[s.symbol]
      if (q) totalChange += s.shares * q.change
    })
    return totalChange
  }, [stocks, quotes])

  // ─── Chart Data ───

  // Asset allocation pie
  const allocationData = useMemo(() => {
    const data = []
    if (stockTotals.totalValue > 0) data.push({ name: "Stocks", value: stockTotals.totalValue })
    if (fundTotals.current > 0) data.push({ name: "Mutual Funds", value: fundTotals.current })
    return data
  }, [stockTotals, fundTotals])

  // Per-stock invested vs current (top 8)
  const stockBarData = useMemo(() => {
    return stocks
      .map((s) => {
        const q = quotes[s.symbol]
        const cmp = q?.current || s.averageCost
        const current = s.shares * cmp
        const invested = s.shares * s.averageCost
        return { name: s.symbol, current, invested }
      })
      .sort((a, b) => b.current - a.current)
      .slice(0, 8)
  }, [stocks, quotes])

  // Per-stock P&L
  const stockPLData = useMemo(() => {
    return stocks
      .map((s) => {
        const q = quotes[s.symbol]
        const cmp = q?.current || s.averageCost
        const pl = s.shares * (cmp - s.averageCost)
        const plPct = s.averageCost > 0 ? ((cmp - s.averageCost) / s.averageCost) * 100 : 0
        return { name: s.symbol, pl, plPct: Math.round(plPct * 10) / 10, fill: pl >= 0 ? COLORS.emerald : COLORS.red }
      })
      .sort((a, b) => b.pl - a.pl)
  }, [stocks, quotes])

  // MF category pie
  const fundCategoryData = useMemo(() => {
    const catMap = new Map<string, number>()
    mutualFunds.forEach((f) => {
      const cat = f.category || "Other"
      catMap.set(cat, (catMap.get(cat) || 0) + f.currentValue)
    })
    return Array.from(catMap.entries()).map(([name, value]) => ({ name, value }))
  }, [mutualFunds])

  // Per-stock weight in portfolio
  const stockWeightData = useMemo(() => {
    return stocks
      .map((s) => {
        const q = quotes[s.symbol]
        const value = s.shares * (q?.current || s.averageCost)
        return { name: s.symbol, value }
      })
      .sort((a, b) => b.value - a.value)
  }, [stocks, quotes])

  // Exited stocks from transaction history
  const exitedStocks = useMemo(() => {
    if (!stockTxns.length) return []
    const map = new Map<string, { symbol: string; buyQty: number; buyValue: number; sellQty: number; sellValue: number }>()
    stockTxns.forEach((txn) => {
      const sym = txn.symbol
      const entry = map.get(sym) || { symbol: sym, buyQty: 0, buyValue: 0, sellQty: 0, sellValue: 0 }
      if (txn.type === "BUY") {
        entry.buyQty += txn.quantity
        entry.buyValue += txn.value
      } else {
        entry.sellQty += txn.quantity
        entry.sellValue += txn.value
      }
      map.set(sym, entry)
    })
    return Array.from(map.values())
      .filter((e) => e.buyQty > 0 && e.sellQty > 0 && e.sellQty >= e.buyQty)
      .map((e) => ({
        symbol: e.symbol,
        realizedPL: e.sellValue - e.buyValue,
        buyValue: e.buyValue,
        sellValue: e.sellValue,
      }))
  }, [stockTxns])

  const realizedPL = useMemo(() => exitedStocks.reduce((sum, e) => sum + e.realizedPL, 0), [exitedStocks])

  // XIRR for stocks (from transaction history)
  const stockXIRR = useMemo(() => {
    if (!stockTxns.length) return null
    const buyTxns = stockTxns
      .filter((t) => t.type === "BUY")
      .map((t) => ({
        date: new Date(t.executionDate),
        amount: t.value,
      }))
      .filter((t) => !isNaN(t.date.getTime()))
    if (!buyTxns.length) return null
    return calculateInvestmentXIRR(buyTxns, stockTotals.totalValue)
  }, [stockTxns, stockTotals.totalValue])

  // XIRR for mutual funds (from transaction history)
  const fundXIRR = useMemo(() => {
    if (!mutualFundTxns.length) return null
    const purchases = mutualFundTxns
      .filter((t) => t.transactionType?.toUpperCase() === "PURCHASE")
      .map((t) => ({
        date: new Date(t.date),
        amount: Number(t.amount) || 0,
      }))
      .filter((t) => !isNaN(t.date.getTime()) && t.amount > 0)
    if (!purchases.length) return null
    return calculateInvestmentXIRR(purchases, fundTotals.current)
  }, [mutualFundTxns, fundTotals.current])

  // Portfolio XIRR
  const portfolioXIRR = useMemo(() => {
    const allInvestments: Array<{ date: Date; amount: number }> = []
    stockTxns.filter((t) => t.type === "BUY").forEach((t) => {
      const d = new Date(t.executionDate)
      if (!isNaN(d.getTime())) allInvestments.push({ date: d, amount: t.value })
    })
    mutualFundTxns.filter((t) => t.transactionType?.toUpperCase() === "PURCHASE").forEach((t) => {
      const d = new Date(t.date)
      const amt = Number(t.amount) || 0
      if (!isNaN(d.getTime()) && amt > 0) allInvestments.push({ date: d, amount: amt })
    })
    if (!allInvestments.length) return null
    return calculateInvestmentXIRR(allInvestments, portfolioTotal.current)
  }, [stockTxns, mutualFundTxns, portfolioTotal.current])

  // SIP Projections - use expected return or fallback to 12%
  const sipProjections = useMemo(() => {
    const activeSips = sips.filter((s) => s.status === "active")
    if (!activeSips.length) return null

    const monthlyTotal = activeSips.reduce((sum, s) => sum + s.monthlyAmount, 0)
    // Use average expected return from SIPs, fallback to 12%
    const avgReturn = activeSips.reduce((sum, s) => sum + (s.expectedAnnualReturn || 12), 0) / activeSips.length
    const monthlyRate = avgReturn / 100 / 12

    const projectForYears = (years: number) => {
      const months = years * 12
      // FV of annuity: PMT * ((1 + r)^n - 1) / r * (1 + r)
      const fv = monthlyTotal * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
      const invested = monthlyTotal * months
      return { years, invested, projected: Math.round(fv), returns: Math.round(fv - invested), returnPct: ((fv - invested) / invested * 100) }
    }

    return {
      monthlyTotal,
      avgReturn: Math.round(avgReturn * 10) / 10,
      projections: [
        projectForYears(3),
        projectForYears(5),
        projectForYears(10),
        projectForYears(15),
        projectForYears(20),
      ],
      chartData: Array.from({ length: 21 }, (_, i) => {
        const months = i * 12
        const invested = monthlyTotal * months
        const projected = months > 0 ? monthlyTotal * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate) : 0
        return { year: i, invested: Math.round(invested), projected: Math.round(projected) }
      }),
    }
  }, [sips])

  // ─── Render ───

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Skeleton className="h-8 w-48" /></div>
  if (!isAuthenticated) return null

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Investments" subtitle="Portfolio tracker with live quotes" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">

            {/* ══════════════════════════════════════════════════════════════
                SECTION 1: Portfolio Hero
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid gap-4 @[640px]/main:grid-cols-2 @[1200px]/main:grid-cols-12">
              {/* Main portfolio card - spans wider */}
              <Card className="border border-border/70 @[1200px]/main:col-span-4 bg-gradient-to-br from-background to-muted/30">
                <CardContent className="p-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Portfolio</div>
                  <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{fmt(portfolioTotal.current)}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`flex items-center gap-0.5 text-sm font-semibold ${portfolioTotal.pl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {portfolioTotal.pl >= 0 ? <IconArrowUp className="size-3.5" /> : <IconArrowDown className="size-3.5" />}
                      {fmt(portfolioTotal.pl)}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${portfolioTotal.plPercent >= 0 ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                      {portfolioTotal.plPercent >= 0 ? "+" : ""}{portfolioTotal.plPercent.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/50 pt-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invested</div>
                      <div className="text-sm font-semibold tabular-nums">{fmt(portfolioTotal.invested)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Day Change</div>
                      <div className={`text-sm font-semibold tabular-nums ${dayChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {dayChange >= 0 ? "+" : ""}{fmt(dayChange)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">XIRR</div>
                      <div className={`text-sm font-semibold tabular-nums ${(portfolioXIRR || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {portfolioXIRR !== null ? `${portfolioXIRR >= 0 ? "+" : ""}${portfolioXIRR.toFixed(1)}%` : <span className="text-muted-foreground text-xs">N/A</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick metric tiles */}
              <div className="@[1200px]/main:col-span-8 grid grid-cols-2 @[640px]/main:grid-cols-4 gap-3">
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconChartLine className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Stocks</span>
                    </div>
                    <div className="mt-1.5 text-xl font-bold tabular-nums">{fmt(stockTotals.totalValue)}</div>
                    <div className={`text-xs font-medium ${stockTotals.totalPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {stockTotals.totalPL >= 0 ? "+" : ""}{stockTotals.plPercent.toFixed(1)}% ({stocks.length})
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconChartBar className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Mutual Funds</span>
                    </div>
                    <div className="mt-1.5 text-xl font-bold tabular-nums">{fmt(fundTotals.current)}</div>
                    <div className={`text-xs font-medium ${fundTotals.returns >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fundTotals.returns >= 0 ? "+" : ""}{fundTotals.plPercent.toFixed(1)}% ({mutualFunds.length})
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconCoin className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Monthly SIP</span>
                    </div>
                    <div className="mt-1.5 text-xl font-bold tabular-nums">{fmt(sipTotals.monthlyTotal)}</div>
                    <div className="text-xs text-muted-foreground">{sipTotals.active} active of {sipTotals.total}</div>
                  </CardContent>
                </Card>
                <Card className="border border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconTrendingUp className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Realized P&L</span>
                    </div>
                    <div className={`mt-1.5 text-xl font-bold tabular-nums ${realizedPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {realizedPL >= 0 ? "+" : ""}{fmt(realizedPL)}
                    </div>
                    <div className="text-xs text-muted-foreground">{exitedStocks.length} exited positions</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2: Charts Dashboard
            ══════════════════════════════════════════════════════════════ */}
            {(allocationData.length > 0 || stockBarData.length > 0 || fundCategoryData.length > 0) && (
              <div className="grid gap-4 @[640px]/main:grid-cols-2 @[1200px]/main:grid-cols-12">

                {/* Asset Allocation + Stock Weight combined */}
                <Card className="border border-border/70 @[1200px]/main:col-span-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Asset Allocation</CardTitle>
                    <CardDescription className="text-xs">Portfolio breakdown by asset type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {allocationData.length > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="h-[140px] w-[140px] flex-shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={65} strokeWidth={0} paddingAngle={3}>
                                {allocationData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          {allocationData.map((d, i) => {
                            const pct = portfolioTotal.current > 0 ? (d.value / portfolioTotal.current) * 100 : 0
                            return (
                              <div key={d.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className="text-xs font-medium">{d.name}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                                </div>
                                <Progress value={pct} className="h-1.5" />
                              </div>
                            )
                          })}
                          <div className="border-t border-border/40 pt-2 mt-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Invested</div>
                            <div className="text-sm font-semibold">{fmt(portfolioTotal.invested)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stock weight breakdown */}
                    {stockWeightData.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40">
                        <div className="text-xs font-medium mb-2 text-muted-foreground">Stock Weights</div>
                        <div className="space-y-1.5">
                          {stockWeightData.slice(0, 5).map((s, i) => {
                            const pct = stockTotals.totalValue > 0 ? (s.value / stockTotals.totalValue) * 100 : 0
                            return (
                              <div key={s.name} className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-xs font-medium w-20 truncate">{s.name}</span>
                                <div className="flex-1">
                                  <Progress value={pct} className="h-1" />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Stock P&L */}
                {stockPLData.length > 0 && (
                  <Card className="border border-border/70 @[1200px]/main:col-span-4">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Stock P&L</CardTitle>
                      <CardDescription className="text-xs">Unrealized profit / loss per stock</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-2.5">
                        {(() => {
                          const maxAbsPL = Math.max(...stockPLData.map((d) => Math.abs(d.pl)), 1)
                          return stockPLData.map((entry) => {
                          const barWidth = Math.max((Math.abs(entry.pl) / maxAbsPL) * 100, 4)
                          const isPositive = entry.pl >= 0
                          return (
                            <div key={entry.name} className="group/bar">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{entry.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-semibold tabular-nums ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                    {isPositive ? "+" : ""}{fmt(entry.pl)}
                                  </span>
                                  <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${isPositive ? "text-emerald-600 border-emerald-200/60" : "text-rose-600 border-rose-200/60"}`}>
                                    {isPositive ? "+" : ""}{entry.plPct}%
                                  </Badge>
                                </div>
                              </div>
                              <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${isPositive ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-rose-500 to-rose-400"}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          )
                        })
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Holdings Value (invested vs current) + MF Category */}
                <div className="@[1200px]/main:col-span-4 grid gap-4">
                  {stockBarData.length > 0 && (
                    <Card className="border border-border/70">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-sm font-medium">Holdings Value</CardTitle>
                          <CardDescription className="text-xs">Invested vs Current</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refreshQuotes(stocks)} disabled={isRefreshing}>
                          <IconRefresh className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[120px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stockBarData} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                              <XAxis type="number" tickFormatter={(v: number) => fmtCompact(v)} fontSize={9} axisLine={false} tickLine={false} />
                              <YAxis type="category" dataKey="name" width={60} fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip content={<CustomBarTooltip />} />
                              <Bar dataKey="invested" name="Invested" fill="#94a3b8" radius={[0, 0, 0, 0]} barSize={8} />
                              <Bar dataKey="current" name="Current" fill={COLORS.indigo} radius={[0, 3, 3, 0]} barSize={8} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {fundCategoryData.length > 0 && (
                    <Card className="border border-border/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">MF Category Split</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="h-[100px] w-[100px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={fundCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={48} strokeWidth={0} paddingAngle={3}>
                                  {fundCategoryData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            {fundCategoryData.map((d, i) => {
                              const total = fundCategoryData.reduce((s, x) => s + x.value, 0)
                              const pct = total > 0 ? (d.value / total) * 100 : 0
                              return (
                                <div key={d.name} className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} />
                                  <span className="text-xs truncate flex-1">{d.name}</span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* CRUD Error Banner */}
            {crudError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 flex items-center justify-between">
                <span>{crudError}</span>
                <button onClick={() => setCrudError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-medium ml-4">Dismiss</button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3: Tabs
            ══════════════════════════════════════════════════════════════ */}
            <Tabs defaultValue="stocks" className="space-y-4">
              <TabsList>
                <TabsTrigger value="stocks">Stocks ({stocks.length})</TabsTrigger>
                <TabsTrigger value="stock-txns">Stock Orders ({stockTxns.length})</TabsTrigger>
                <TabsTrigger value="funds">Mutual Funds ({mutualFunds.length})</TabsTrigger>
                <TabsTrigger value="sips">SIPs ({sips.length})</TabsTrigger>
              </TabsList>

              {/* ── STOCKS TAB ── */}
              <TabsContent value="stocks" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => setShowAddStock(!showAddStock)}>
                    <IconPlus className="mr-1 size-4" /> Add Stock
                  </Button>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
                    <IconUpload className="size-4" />
                    Import Holdings CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportStocks(e.target.files?.[0])} />
                  </label>
                  <ReplaceToggle checked={replaceStocks} onChange={setReplaceStocks} label="Replace existing on import" />
                  <Button variant="ghost" size="sm" onClick={() => refreshQuotes(stocks)} disabled={isRefreshing}>
                    <IconRefresh className={`mr-1 size-4 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
                  </Button>
                </div>
                {stockImportMsg && <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{stockImportMsg}</div>}

                {showAddStock && (
                  <Card className="border border-border/70">
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-5">
                        <div className="space-y-1"><Label className="text-xs">Symbol</Label><Input placeholder="RELIANCE" value={stockForm.symbol} onChange={(e) => setStockForm({ ...stockForm, symbol: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Exchange</Label>
                          <Select value={stockForm.exchange} onValueChange={(v) => setStockForm({ ...stockForm, exchange: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NSE">NSE</SelectItem><SelectItem value="BSE">BSE</SelectItem><SelectItem value="NASDAQ">NASDAQ</SelectItem><SelectItem value="NYSE">NYSE</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Shares</Label><Input type="number" value={stockForm.shares} onChange={(e) => setStockForm({ ...stockForm, shares: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Avg Cost</Label><Input type="number" value={stockForm.averageCost} onChange={(e) => setStockForm({ ...stockForm, averageCost: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Exp. Return %</Label><Input type="number" value={stockForm.expectedAnnualReturn} onChange={(e) => setStockForm({ ...stockForm, expectedAnnualReturn: e.target.value })} /></div>
                      </div>
                      <Button size="sm" onClick={handleAddStock}><IconPlus className="mr-1 size-4" /> Add</Button>
                    </CardContent>
                  </Card>
                )}

                {isLoading ? <Skeleton className="h-40" /> : stocks.length === 0 ? (
                  <Card className="border border-dashed border-border/70"><CardContent className="py-12 text-center text-sm text-muted-foreground">No stocks yet. Add manually or import a CSV from Groww.</CardContent></Card>
                ) : (
                  <Card className="border border-border/70 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-medium">Stock</TableHead>
                          <TableHead className="text-right font-medium">Shares</TableHead>
                          <TableHead className="text-right font-medium">Avg Cost</TableHead>
                          <TableHead className="text-right font-medium">CMP</TableHead>
                          <TableHead className="text-right font-medium">Invested</TableHead>
                          <TableHead className="text-right font-medium">Current</TableHead>
                          <TableHead className="text-right font-medium">P&L</TableHead>
                          <TableHead className="text-right font-medium">Change</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stocks.map((s) => {
                          const q = quotes[s.symbol]
                          const cmp = q?.current || s.averageCost
                          const invested = s.shares * s.averageCost
                          const current = s.shares * cmp
                          const pl = current - invested
                          const plPct = invested > 0 ? (pl / invested) * 100 : 0
                          return (
                            <TableRow key={s._id} className="group">
                              <TableCell>
                                <div className="font-medium">{s.symbol}</div>
                                <div className="text-xs text-muted-foreground">{s.exchange}</div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{s.shares}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(s.averageCost)}</TableCell>
                              <TableCell className="text-right tabular-nums">{q?.current ? fmt(cmp) : <span className="text-muted-foreground" title="Using avg cost">{fmt(cmp)}*</span>}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(invested)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(current)}{!q?.current && <span className="text-muted-foreground">*</span>}</TableCell>
                              <TableCell className="text-right">
                                <span className={pl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                  {fmt(pl)} <span className="text-xs">({plPct.toFixed(1)}%)</span>
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {q ? (
                                  <Badge variant="outline" className={`text-xs ${q.changePercent >= 0 ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                                    {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStock(s)}><IconEdit className="size-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteStock(s._id)}><IconTrash className="size-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
                      <span className="font-medium">Total</span>
                      <div className="flex gap-6">
                        <span>Invested: <strong>{fmt(stockTotals.totalInvested)}</strong></span>
                        <span>Current: <strong>{fmt(stockTotals.totalValue)}</strong></span>
                        <span className={stockTotals.totalPL >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                          P&L: {fmt(stockTotals.totalPL)} ({stockTotals.plPercent.toFixed(1)}%)
                        </span>
                        {stockXIRR !== null && (
                          <span className={stockXIRR >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            XIRR: {stockXIRR >= 0 ? "+" : ""}{stockXIRR.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* ── STOCK ORDERS TAB ── */}
              <TabsContent value="stock-txns" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
                    <IconUpload className="size-4" /> Import Order History CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportStockTxns(e.target.files?.[0])} />
                  </label>
                  <ReplaceToggle checked={replaceStockTxns} onChange={setReplaceStockTxns} label="Replace existing on import" />
                </div>
                {stockTxnImportMsg && <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{stockTxnImportMsg}</div>}

                {/* Exited positions summary */}
                {exitedStocks.length > 0 && (
                  <Card className="border border-border/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Exited Positions</CardTitle>
                      <CardDescription className="text-xs">Stocks fully sold - realized P&L</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {exitedStocks.map((e) => (
                          <div key={e.symbol} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium">{e.symbol}</div>
                              <div className="text-[10px] text-muted-foreground">Buy: {fmtPrecise(e.buyValue)} → Sell: {fmtPrecise(e.sellValue)}</div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${e.realizedPL >= 0 ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                              {e.realizedPL >= 0 ? "+" : ""}{fmtPrecise(e.realizedPL)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Transaction list */}
                {isLoading ? <Skeleton className="h-40" /> : stockTxns.length === 0 ? (
                  <Card className="border border-dashed border-border/70"><CardContent className="py-12 text-center text-sm text-muted-foreground">No stock transactions yet. Import your Groww Order History CSV.</CardContent></Card>
                ) : (
                  <Card className="border border-border/70 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-medium">Stock</TableHead>
                          <TableHead className="font-medium">Type</TableHead>
                          <TableHead className="text-right font-medium">Qty</TableHead>
                          <TableHead className="text-right font-medium">Value</TableHead>
                          <TableHead className="text-right font-medium">Price/Unit</TableHead>
                          <TableHead className="font-medium">Exchange</TableHead>
                          <TableHead className="font-medium">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockTxns.map((txn) => {
                          const pricePerUnit = txn.quantity > 0 ? txn.value / txn.quantity : 0
                          return (
                            <TableRow key={txn._id}>
                              <TableCell>
                                <div className="font-medium">{txn.symbol}</div>
                                <div className="text-xs text-muted-foreground max-w-[200px] truncate">{txn.stockName}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${txn.type === "BUY" ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                                  {txn.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{txn.quantity}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{fmtPrecise(txn.value)}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPrecise(pricePerUnit)}</TableCell>
                              <TableCell className="text-muted-foreground">{txn.exchange}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{txn.executionDate}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
                      <span className="font-medium">{stockTxns.length} transaction(s)</span>
                      <div className="flex gap-4">
                        <span className="text-emerald-600">Buy: {fmt(stockTxns.filter((t) => t.type === "BUY").reduce((s, t) => s + t.value, 0))}</span>
                        <span className="text-rose-600">Sell: {fmt(stockTxns.filter((t) => t.type === "SELL").reduce((s, t) => s + t.value, 0))}</span>
                      </div>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* ── MUTUAL FUNDS TAB ── */}
              <TabsContent value="funds" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
                    <IconUpload className="size-4" /> Import Holdings CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportFunds(e.target.files?.[0])} />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
                    <IconUpload className="size-4" /> Import Order History
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportFundTxns(e.target.files?.[0])} />
                  </label>
                  <ReplaceToggle checked={replaceFunds} onChange={setReplaceFunds} label="Replace holdings on import" />
                  <ReplaceToggle checked={replaceFundTxns} onChange={setReplaceFundTxns} label="Replace transactions on import" />
                </div>
                {fundImportMsg && <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{fundImportMsg}</div>}
                {fundTxnImportMsg && <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{fundTxnImportMsg}</div>}

                {/* Fund summary row */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invested</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(fundTotals.invested)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Value</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(fundTotals.current)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Returns</div>
                      <div className={`mt-1 text-2xl font-semibold tabular-nums ${fundTotals.returns >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {fmt(fundTotals.returns)} <span className="text-sm">({fundTotals.plPercent.toFixed(1)}%)</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {isLoading ? <Skeleton className="h-40" /> : mutualFunds.length === 0 ? (
                  <Card className="border border-dashed border-border/70"><CardContent className="py-12 text-center text-sm text-muted-foreground">No mutual funds yet. Import your Groww holdings CSV.</CardContent></Card>
                ) : (
                  <Card className="border border-border/70 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-medium">Scheme</TableHead>
                          <TableHead className="text-right font-medium">Units</TableHead>
                          <TableHead className="text-right font-medium">Invested</TableHead>
                          <TableHead className="text-right font-medium">Current</TableHead>
                          <TableHead className="text-right font-medium">P&L</TableHead>
                          <TableHead className="text-right font-medium">Returns %</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mutualFunds.map((f) => {
                          const ret = f.currentValue - f.investedValue
                          const retPct = f.investedValue > 0 ? (ret / f.investedValue) * 100 : 0
                          return (
                            <TableRow key={f._id} className="group">
                              <TableCell>
                                <div className="font-medium max-w-[280px] truncate">{f.schemeName}</div>
                                <div className="text-xs text-muted-foreground">{[f.amc, f.category].filter(Boolean).join(" - ") || "Mutual Fund"}</div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{Number(f.units).toFixed(3)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(f.investedValue)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(f.currentValue)}</TableCell>
                              <TableCell className="text-right">
                                <span className={ret >= 0 ? "text-emerald-600" : "text-rose-600"}>{fmt(ret)}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className={`text-xs ${retPct >= 0 ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                                  {retPct >= 0 ? "+" : ""}{retPct.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFund(f)}><IconEdit className="size-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFund(f._id)}><IconTrash className="size-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
                      <span className="font-medium">Total ({mutualFunds.length} schemes)</span>
                      <div className="flex gap-6">
                        <span>Invested: <strong>{fmt(fundTotals.invested)}</strong></span>
                        <span>Current: <strong>{fmt(fundTotals.current)}</strong></span>
                        <span className={fundTotals.returns >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                          P&L: {fmt(fundTotals.returns)} ({fundTotals.plPercent.toFixed(1)}%)
                        </span>
                        {fundXIRR !== null && (
                          <span className={fundXIRR >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            XIRR: {fundXIRR >= 0 ? "+" : ""}{fundXIRR.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Recent Transactions */}
                {mutualFundTxns.length > 0 && (
                  <Card className="border border-border/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Recent MF Transactions</CardTitle>
                      <CardDescription>{mutualFundTxns.length} total entries</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {mutualFundTxns.slice(0, 8).map((txn) => (
                          <div key={txn._id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
                            <div>
                              <div className="text-sm font-medium max-w-[300px] truncate">{txn.schemeName}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${txn.transactionType === "PURCHASE" ? "text-emerald-600 border-emerald-200" : "text-rose-600 border-rose-200"}`}>
                                  {txn.transactionType}
                                </Badge>
                                {txn.date}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold tabular-nums">{fmt(Number(txn.amount || 0))}</div>
                              {Number(txn.units) > 0 && <div className="text-xs text-muted-foreground">{Number(txn.units).toFixed(3)} units</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── SIPs TAB ── */}
              <TabsContent value="sips" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => setShowAddSip(!showAddSip)}>
                    <IconPlus className="mr-1 size-4" /> Add SIP
                  </Button>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
                    <IconUpload className="size-4" /> Import from MF Order History
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportSips(e.target.files?.[0])} />
                  </label>
                  <ReplaceToggle checked={replaceSips} onChange={setReplaceSips} label="Replace existing on import" />
                </div>
                {sipImportMsg && <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{sipImportMsg}</div>}
                <div className="text-xs text-muted-foreground">
                  SIPs are auto-detected from Groww MF Order History: schemes with 2+ PURCHASE transactions are treated as SIPs. XIRR from transaction data: {fundXIRR !== null ? `${fundXIRR >= 0 ? "+" : ""}${fundXIRR.toFixed(1)}%` : "N/A"}.
                </div>

                {showAddSip && (
                  <Card className="border border-border/70">
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1"><Label className="text-xs">Scheme Name</Label><Input placeholder="Axis Gold Fund" value={sipForm.name} onChange={(e) => setSipForm({ ...sipForm, name: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Provider</Label><Input placeholder="Groww" value={sipForm.provider} onChange={(e) => setSipForm({ ...sipForm, provider: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Monthly Amount</Label><Input type="number" value={sipForm.monthlyAmount} onChange={(e) => setSipForm({ ...sipForm, monthlyAmount: e.target.value })} /></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={sipForm.startDate} onChange={(e) => setSipForm({ ...sipForm, startDate: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Expected Return %</Label><Input type="number" value={sipForm.expectedAnnualReturn} onChange={(e) => setSipForm({ ...sipForm, expectedAnnualReturn: e.target.value })} /></div>
                        <div className="space-y-1"><Label className="text-xs">Status</Label>
                          <Select value={sipForm.status} onValueChange={(v) => setSipForm({ ...sipForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
                        </div>
                      </div>
                      <Button size="sm" onClick={handleAddSip}><IconPlus className="mr-1 size-4" /> Add</Button>
                    </CardContent>
                  </Card>
                )}

                {/* SIP Summary */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Monthly Outflow</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(sipTotals.monthlyTotal)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Yearly Outflow</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(sipTotals.yearlyTotal)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/70">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active SIPs</div>
                      <div className="mt-1 text-2xl font-semibold">{sipTotals.active} <span className="text-sm text-muted-foreground font-normal">of {sipTotals.total}</span></div>
                    </CardContent>
                  </Card>
                </div>

                {isLoading ? <Skeleton className="h-40" /> : sips.length === 0 ? (
                  <Card className="border border-dashed border-border/70"><CardContent className="py-12 text-center text-sm text-muted-foreground">No SIPs yet. Add manually or import your Groww MF Order History CSV.</CardContent></Card>
                ) : (
                  <Card className="border border-border/70 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-medium">Scheme</TableHead>
                          <TableHead className="font-medium">Provider</TableHead>
                          <TableHead className="text-right font-medium">Monthly</TableHead>
                          <TableHead className="font-medium">Start Date</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sips.map((s) => (
                          <TableRow key={s._id} className="group">
                            <TableCell>
                              <div className="font-medium max-w-[260px] truncate">{s.name}</div>
                              {s.expectedAnnualReturn && <div className="text-xs text-muted-foreground">Exp. {s.expectedAnnualReturn}% p.a.</div>}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{s.provider}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{fmt(s.monthlyAmount)}</TableCell>
                            <TableCell className="text-muted-foreground">{s.startDate}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${s.status === "active" ? "text-emerald-600 border-emerald-200" : s.status === "paused" ? "text-amber-600 border-amber-200" : "text-rose-600 border-rose-200"}`}>
                                {s.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSip(s)}><IconEdit className="size-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSip(s._id)}><IconTrash className="size-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
                      <span className="font-medium">{sips.length} SIP(s)</span>
                      <span>Monthly total: <strong>{fmt(sipTotals.monthlyTotal)}</strong></span>
                    </div>
                  </Card>
                )}

                {/* SIP Projection Calculator */}
                {sipProjections && (
                  <Card className="border border-border/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <IconTrendingUp className="size-4" /> SIP Projection Calculator
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Projected growth at {sipProjections.avgReturn}% annualized return with {fmt(sipProjections.monthlyTotal)}/month SIP
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 @[640px]/main:grid-cols-2">
                        {/* Projection Chart */}
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sipProjections.chartData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="year" fontSize={10} tickFormatter={(v: number) => `${v}Y`} axisLine={false} tickLine={false} />
                              <YAxis fontSize={9} tickFormatter={(v: number) => fmtCompact(v)} axisLine={false} tickLine={false} />
                              <Tooltip
                                formatter={(value: number, name: string) => [fmt(value), name === "invested" ? "Invested" : "Projected"]}
                                labelFormatter={(label: number) => `Year ${label}`}
                              />
                              <Area type="monotone" dataKey="invested" name="Invested" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeWidth={1.5} />
                              <Area type="monotone" dataKey="projected" name="Projected" stroke={COLORS.emerald} fill={COLORS.emerald} fillOpacity={0.15} strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Projection Table */}
                        <div className="space-y-2">
                          {sipProjections.projections.map((p) => (
                            <div key={p.years} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                              <div>
                                <div className="text-sm font-medium">{p.years} Years</div>
                                <div className="text-[10px] text-muted-foreground">Invested: {fmt(p.invested)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold tabular-nums text-emerald-600">{fmt(p.projected)}</div>
                                <div className="text-[10px] text-emerald-600">+{fmt(p.returns)} ({p.returnPct.toFixed(0)}%)</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* SIP Deduction Matching */}
                {(sipMatches.length > 0 || unmatchedGrowwTxns.length > 0) && (
                  <Card className="border border-border/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <IconWallet className="size-4" /> SIP Deduction Matching
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Bank transactions matched to registered SIPs ({sipMatches.length} matched, {unmatchedGrowwTxns.length} unmatched)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sipMatches.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">Matched Deductions</div>
                          <div className="space-y-1.5">
                            {sipMatches.slice(0, 10).map((m, i) => (
                              <div key={i} className="flex items-center justify-between rounded-lg border border-emerald-200/60 bg-emerald-50/30 dark:bg-emerald-950/10 px-3 py-2">
                                <div>
                                  <div className="text-xs font-medium max-w-[260px] truncate">{m.sipName}</div>
                                  <div className="text-[10px] text-muted-foreground">{m.bankTxn.date} - {m.bankTxn.description.slice(0, 40)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold tabular-nums">{fmt(m.bankTxn.amount)}</div>
                                  <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200">
                                    matched
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {unmatchedGrowwTxns.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">Unmatched Groww Transactions</div>
                          <div className="space-y-1.5">
                            {unmatchedGrowwTxns.slice(0, 8).map((txn, i) => (
                              <div key={i} className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 px-3 py-2">
                                <div>
                                  <div className="text-xs text-muted-foreground">{txn.date}</div>
                                  <div className="text-[10px] text-muted-foreground max-w-[300px] truncate">{txn.description}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold tabular-nums">{fmt(txn.amount)}</div>
                                  <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">
                                    unmatched
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>

      {/* ── Edit Stock Dialog ── */}
      <Dialog open={!!editingStock} onOpenChange={(open) => { if (!open) setEditingStock(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Stock</DialogTitle><DialogDescription>Update holding details</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Symbol</Label><Input value={editStockForm.symbol} onChange={(e) => setEditStockForm({ ...editStockForm, symbol: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exchange</Label>
                <Select value={editStockForm.exchange} onValueChange={(v) => setEditStockForm({ ...editStockForm, exchange: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NSE">NSE</SelectItem><SelectItem value="BSE">BSE</SelectItem><SelectItem value="NASDAQ">NASDAQ</SelectItem><SelectItem value="NYSE">NYSE</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>Shares</Label><Input type="number" value={editStockForm.shares} onChange={(e) => setEditStockForm({ ...editStockForm, shares: e.target.value })} /></div>
              <div className="space-y-1"><Label>Avg Cost</Label><Input type="number" value={editStockForm.averageCost} onChange={(e) => setEditStockForm({ ...editStockForm, averageCost: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exp. Return %</Label><Input type="number" value={editStockForm.expectedAnnualReturn} onChange={(e) => setEditStockForm({ ...editStockForm, expectedAnnualReturn: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingStock(null)}>Cancel</Button><Button onClick={saveEditStock} disabled={isSavingEdit}>{isSavingEdit ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit MF Dialog ── */}
      <Dialog open={!!editingFund} onOpenChange={(open) => { if (!open) setEditingFund(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Mutual Fund</DialogTitle><DialogDescription>Update fund details</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Scheme Name</Label><Input value={editFundForm.schemeName} onChange={(e) => setEditFundForm({ ...editFundForm, schemeName: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>AMC</Label><Input value={editFundForm.amc} onChange={(e) => setEditFundForm({ ...editFundForm, amc: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={editFundForm.category} onChange={(e) => setEditFundForm({ ...editFundForm, category: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>Units</Label><Input type="number" step="0.001" value={editFundForm.units} onChange={(e) => setEditFundForm({ ...editFundForm, units: e.target.value })} /></div>
              <div className="space-y-1"><Label>Invested</Label><Input type="number" value={editFundForm.investedValue} onChange={(e) => setEditFundForm({ ...editFundForm, investedValue: e.target.value })} /></div>
              <div className="space-y-1"><Label>Current Value</Label><Input type="number" value={editFundForm.currentValue} onChange={(e) => setEditFundForm({ ...editFundForm, currentValue: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingFund(null)}>Cancel</Button><Button onClick={saveEditFund} disabled={isSavingEdit}>{isSavingEdit ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit SIP Dialog ── */}
      <Dialog open={!!editingSip} onOpenChange={(open) => { if (!open) setEditingSip(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit SIP</DialogTitle><DialogDescription>Update SIP details</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Scheme Name</Label><Input value={editSipForm.name} onChange={(e) => setEditSipForm({ ...editSipForm, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Provider</Label><Input value={editSipForm.provider} onChange={(e) => setEditSipForm({ ...editSipForm, provider: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>Monthly Amount</Label><Input type="number" value={editSipForm.monthlyAmount} onChange={(e) => setEditSipForm({ ...editSipForm, monthlyAmount: e.target.value })} /></div>
              <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={editSipForm.startDate} onChange={(e) => setEditSipForm({ ...editSipForm, startDate: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exp. Return %</Label><Input type="number" value={editSipForm.expectedAnnualReturn} onChange={(e) => setEditSipForm({ ...editSipForm, expectedAnnualReturn: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={editSipForm.status} onValueChange={(v) => setEditSipForm({ ...editSipForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingSip(null)}>Cancel</Button><Button onClick={saveEditSip} disabled={isSavingEdit}>{isSavingEdit ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
