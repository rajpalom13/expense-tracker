"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Types ───

export interface IncomeSource {
  name: string
  expected: number
  frequency: string
}

export interface MonthlyBreakdownEntry {
  month: string
  total: number
  sources: Record<string, number>
}

export interface IncomeProgress {
  totalIncome: number
  monthlyBreakdown: MonthlyBreakdownEntry[]
  monthOverMonthGrowth: number | null
  incomeSources: string[]
  fiscalYearStart: string
  fiscalYearEnd: string
  monthsWithData: number
}

export interface IncomeGoal {
  id: string
  userId: string
  targetAmount: number
  targetDate: string
  sources: IncomeSource[]
  createdAt: string
  updatedAt: string
  percentComplete: number
  remaining: number
  monthsRemaining: number
  monthlyRequired: number
  onTrack: boolean
}

interface IncomeGoalResponse {
  success: boolean
  goal: IncomeGoal | null
  progress: IncomeProgress
  error?: string
  message?: string
}

interface MutationResponse {
  success: boolean
  goal?: IncomeGoal
  error?: string
  message?: string
}

interface SetIncomeGoalPayload {
  targetAmount: number
  targetDate: string
  sources?: IncomeSource[]
}

// ─── Fetcher ───

async function fetchIncomeGoal(): Promise<IncomeGoalResponse> {
  const res = await fetch("/api/income-goals", {
    credentials: "include",
  })
  const data: IncomeGoalResponse = await res.json()
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to fetch income goal")
  }
  return data
}

// ─── Hooks ───

const QUERY_KEY = ["income-goal"]

export function useIncomeGoal() {
  return useQuery<IncomeGoalResponse>({
    queryKey: QUERY_KEY,
    queryFn: fetchIncomeGoal,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  })
}

export function useSetIncomeGoal() {
  const queryClient = useQueryClient()

  return useMutation<MutationResponse, Error, SetIncomeGoalPayload>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/income-goals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data: MutationResponse = await res.json()
      if (!data.success) {
        throw new Error(data.error || data.message || "Failed to save income goal")
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useDeleteIncomeGoal() {
  const queryClient = useQueryClient()

  return useMutation<MutationResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/income-goals", {
        method: "DELETE",
        credentials: "include",
      })
      const data: MutationResponse = await res.json()
      if (!data.success) {
        throw new Error(data.error || data.message || "Failed to delete income goal")
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
