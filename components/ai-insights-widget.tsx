"use client"

import * as React from "react"
import { IconSparkles, IconRefresh, IconArrowRight } from "@tabler/icons-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface AiInsightsWidgetProps {
  compact?: boolean
}

export function AiInsightsWidget({ compact = false }: AiInsightsWidgetProps) {
  const [analysis, setAnalysis] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null)

  const fetchAnalysis = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()
      if (data.success) {
        setAnalysis(data.analysis)
        setGeneratedAt(data.generatedAt)
      } else {
        setError(data.message || "Failed to generate insights")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Truncate analysis for compact widget view
  const displayText = React.useMemo(() => {
    if (!analysis) return null
    if (!compact) return analysis
    // Show first ~300 chars for compact mode
    const truncated = analysis.slice(0, 300)
    const lastNewline = truncated.lastIndexOf("\n")
    return (lastNewline > 100 ? truncated.slice(0, lastNewline) : truncated) + "..."
  }, [analysis, compact])

  return (
    <Card className="border border-border/70">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">AI Insights</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="h-8 px-2"
          >
            <IconRefresh className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="ml-1 text-xs">{analysis ? "Refresh" : "Generate"}</span>
          </Button>
          {compact && (
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link href="/ai-insights">
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950">
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure OPENROUTER_API_KEY is configured in your .env.local
            </p>
          </div>
        ) : displayText ? (
          <div className="space-y-2">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>h1]:text-base [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:text-sm [&>ul]:my-1 [&>ol]:my-1 [&>p]:my-1">
              <MarkdownRenderer content={displayText} />
            </div>
            {generatedAt && (
              <p className="text-xs text-muted-foreground pt-2">
                Generated {new Date(generatedAt).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <IconSparkles className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Click Generate to get AI-powered insights on your finances
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Simple markdown renderer for AI output
 * Handles headers, lists, bold, and paragraphs
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<br key={key++} />)
    } else if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={key++}>{trimmed.slice(4)}</h3>)
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={key++}>{trimmed.slice(3)}</h2>)
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={key++}>{trimmed.slice(2)}</h1>)
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="text-muted-foreground">-</span>
          <span dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(2)) }} />
        </div>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, "")
      const num = trimmed.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="text-muted-foreground">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />
        </div>
      )
    } else {
      elements.push(<p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />)
    }
  }

  return <>{elements}</>
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function inlineMd(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>')
}
