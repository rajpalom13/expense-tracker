"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AiInsightType, InsightSection } from "@/lib/ai-types"

interface InsightResponse {
  success: boolean
  content?: string
  sections?: InsightSection[] | null
  structuredData?: Record<string, unknown> | null
  generatedAt?: string
  dataPoints?: number
  fromCache?: boolean
  stale?: boolean
  searchContext?: { queries: string[]; snippetCount: number } | null
  warning?: string
  message?: string
}

interface UseAiInsightReturn {
  content: string | null
  sections: InsightSection[] | null
  structuredData: Record<string, unknown> | null
  generatedAt: string | null
  fromCache: boolean
  stale: boolean
  isLoading: boolean
  isRegenerating: boolean
  error: string | null
  regenerate: () => void
}

async function fetchInsight(type: AiInsightType): Promise<InsightResponse> {
  const response = await fetch(`/api/ai/insights?type=${type}`, {
    credentials: "include",
  })
  const data: InsightResponse = await response.json()
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch insight")
  }
  return data
}

async function regenerateInsight(type: AiInsightType): Promise<InsightResponse> {
  const response = await fetch("/api/ai/insights", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  })
  const data: InsightResponse = await response.json()
  if (!data.success) {
    throw new Error(data.message || "Failed to regenerate insight")
  }
  return data
}

export function useAiInsight(type: AiInsightType): UseAiInsightReturn {
  const queryClient = useQueryClient()
  const queryKey = ["ai-insight", type]

  const query = useQuery({
    queryKey,
    queryFn: () => fetchInsight(type),
    staleTime: 5 * 60 * 1000, // 5 min client-side stale time
    retry: 1,
  })

  const mutation = useMutation({
    mutationFn: () => regenerateInsight(type),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
  })

  const data = query.data
  const queryError = query.error instanceof Error ? query.error.message : null
  const mutationError = mutation.error instanceof Error ? mutation.error.message : null

  return {
    content: data?.content ?? null,
    sections: data?.sections ?? null,
    structuredData: data?.structuredData ?? null,
    generatedAt: data?.generatedAt ?? null,
    fromCache: data?.fromCache ?? false,
    stale: data?.stale ?? false,
    isLoading: query.isLoading,
    isRegenerating: mutation.isPending,
    error: mutationError || queryError,
    regenerate: () => mutation.mutate(),
  }
}
