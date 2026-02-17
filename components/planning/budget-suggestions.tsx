"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { IconWand, IconArrowRight, IconCheck, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { formatINR as formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface CategorySuggestion {
  currentBudget: number
  avg3Month: number
  suggestedBudget: number
  reasoning: string
}

interface SuggestResponse {
  success: boolean
  suggestions: Record<string, CategorySuggestion>
  totalCurrent: number
  totalSuggested: number
  monthsAnalyzed: number
  error?: string
}

interface BudgetSuggestionsProps {
  /** Current budgets from parent state */
  currentBudgets: Record<string, number>
  /** Callback when budgets are applied -- parent will call POST /api/budgets */
  onApply: (newBudgets: Record<string, number>) => Promise<void>
}

function getChangeColor(current: number, suggested: number): string {
  if (suggested > current) return "text-amber-600 dark:text-amber-500"
  if (suggested < current) return "text-primary"
  return "text-muted-foreground"
}

function getChangeBadge(current: number, suggested: number) {
  if (suggested === current) return null
  const diff = suggested - current
  const pct = current > 0 ? Math.round((diff / current) * 100) : 0
  const sign = diff > 0 ? "+" : ""
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 ${
        diff > 0
          ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
          : "border-primary/30 text-primary"
      }`}
    >
      {sign}{pct}%
    </Badge>
  )
}

export function BudgetSuggestions({ currentBudgets, onApply }: BudgetSuggestionsProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [data, setData] = useState<SuggestResponse | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch("/api/budgets/suggest")
      const json = (await res.json()) as SuggestResponse
      if (!json.success) {
        toast.error(json.error || "Failed to load suggestions")
        setOpen(false)
        return
      }
      setData(json)

      // Pre-select categories where the suggestion differs from current
      const initial: Record<string, boolean> = {}
      for (const [name, s] of Object.entries(json.suggestions)) {
        initial[name] = s.suggestedBudget !== s.currentBudget
      }
      setSelected(initial)
    } catch {
      toast.error("Network error loading suggestions")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when dialog opens
  useEffect(() => {
    if (open) {
      fetchSuggestions()
    }
  }, [open, fetchSuggestions])

  const handleToggle = (category: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [category]: checked }))
  }

  const handleSelectAll = () => {
    if (!data) return
    const allSelected = Object.entries(data.suggestions).every(
      ([name, s]) => selected[name] || s.suggestedBudget === s.currentBudget
    )
    const next: Record<string, boolean> = {}
    for (const [name, s] of Object.entries(data.suggestions)) {
      next[name] = allSelected ? false : s.suggestedBudget !== s.currentBudget
    }
    setSelected(next)
  }

  const handleApply = async () => {
    if (!data) return
    setApplying(true)
    try {
      // Build the new budget map: apply selected suggestions, keep existing for unselected
      const newBudgets: Record<string, number> = { ...currentBudgets }
      let appliedCount = 0

      for (const [category, suggestion] of Object.entries(data.suggestions)) {
        if (selected[category]) {
          newBudgets[category] = suggestion.suggestedBudget
          appliedCount++
        }
      }

      if (appliedCount === 0) {
        toast.info("No categories selected")
        setApplying(false)
        return
      }

      await onApply(newBudgets)
      toast.success(`Updated ${appliedCount} budget${appliedCount > 1 ? "s" : ""}`)
      setOpen(false)
    } catch {
      toast.error("Failed to apply suggestions")
    } finally {
      setApplying(false)
    }
  }

  // Compute totals based on current selection
  const selectedTotal = React.useMemo(() => {
    if (!data) return { current: 0, suggested: 0 }
    let current = 0
    let suggested = 0
    for (const [name, s] of Object.entries(data.suggestions)) {
      current += s.currentBudget
      suggested += selected[name] ? s.suggestedBudget : s.currentBudget
    }
    return { current, suggested }
  }, [data, selected])

  const selectedCount = Object.values(selected).filter(Boolean).length
  const hasChanges = data
    ? Object.entries(data.suggestions).some(
        ([name, s]) => s.suggestedBudget !== s.currentBudget
      )
    : false

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen(true)}
      >
        <IconWand className="h-3.5 w-3.5" />
        Auto-tune
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Auto-tune Budgets</DialogTitle>
            <DialogDescription>
              Suggestions based on your last{" "}
              {data?.monthsAnalyzed ?? 3} months of spending. Select categories
              to update.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Analyzing spending...
              </span>
            </div>
          ) : data && Object.keys(data.suggestions).length > 0 ? (
            <>
              {/* Scrollable table area */}
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            hasChanges &&
                            Object.entries(data.suggestions).every(
                              ([name, s]) =>
                                selected[name] ||
                                s.suggestedBudget === s.currentBudget
                            )
                          }
                          onCheckedChange={() => handleSelectAll()}
                        />
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-medium">
                        Category
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider font-medium">
                        Current
                      </TableHead>
                      <TableHead className="w-[30px]" />
                      <TableHead className="text-right text-[11px] uppercase tracking-wider font-medium">
                        Suggested
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider font-medium">
                        Avg Spend
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.suggestions)
                      .sort(
                        ([, a], [, b]) =>
                          // Show categories with biggest difference first
                          Math.abs(b.suggestedBudget - b.currentBudget) -
                          Math.abs(a.suggestedBudget - a.currentBudget)
                      )
                      .map(([name, s]) => {
                        const isChanged = s.suggestedBudget !== s.currentBudget
                        return (
                          <TableRow
                            key={name}
                            className={`border-border/30 transition-colors ${
                              selected[name]
                                ? "bg-primary/[0.03]"
                                : "hover:bg-muted/30"
                            } ${!isChanged ? "opacity-50" : ""}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selected[name] ?? false}
                                onCheckedChange={(checked) =>
                                  handleToggle(name, checked === true)
                                }
                                disabled={!isChanged}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {name}
                                </span>
                                {getChangeBadge(s.currentBudget, s.suggestedBudget)}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[260px] truncate">
                                {s.reasoning}
                              </p>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {formatCurrency(s.currentBudget)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isChanged && (
                                <IconArrowRight className="h-3 w-3 text-muted-foreground/50 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums text-sm font-semibold ${getChangeColor(
                                s.currentBudget,
                                s.suggestedBudget
                              )}`}
                            >
                              {formatCurrency(s.suggestedBudget)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                              {formatCurrency(s.avg3Month)}/mo
                            </TableCell>
                          </TableRow>
                        )
                      })}

                    {/* Summary row */}
                    <TableRow className="border-t-2 border-border/60 font-semibold hover:bg-transparent">
                      <TableCell />
                      <TableCell className="text-sm">Total</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatCurrency(selectedTotal.current)}
                      </TableCell>
                      <TableCell className="text-center">
                        {selectedTotal.suggested !== selectedTotal.current && (
                          <IconArrowRight className="h-3 w-3 text-muted-foreground/50 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-sm font-semibold ${getChangeColor(
                          selectedTotal.current,
                          selectedTotal.suggested
                        )}`}
                      >
                        {formatCurrency(selectedTotal.suggested)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Summary bar */}
              {selectedTotal.suggested !== selectedTotal.current && (
                <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Total monthly budget:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(selectedTotal.current)}
                    </span>{" "}
                    <IconArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground/50" />{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(selectedTotal.suggested)}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      selectedTotal.suggested > selectedTotal.current
                        ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                        : "border-primary/30 text-primary"
                    }`}
                  >
                    {selectedTotal.suggested > selectedTotal.current ? "+" : ""}
                    {formatCurrency(
                      selectedTotal.suggested - selectedTotal.current
                    )}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No spending data available to generate suggestions.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={applying || loading || selectedCount === 0}
              className="gap-1.5"
            >
              {applying ? (
                <>
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <IconCheck className="h-3.5 w-3.5" />
                  Apply Selected ({selectedCount})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
