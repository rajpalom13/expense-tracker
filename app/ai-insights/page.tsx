"use client"

import * as React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  IconSparkles,
  IconRefresh,
  IconReportAnalytics,
  IconTargetArrow,
  IconChartPie,
} from "@tabler/icons-react"

import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface InsightSection {
  content: string | null
  isLoading: boolean
  error: string | null
  generatedAt: string | null
}

function useAiInsight(endpoint: string, bodyOverride?: Record<string, unknown>) {
  const [state, setState] = React.useState<InsightSection>({
    content: null,
    isLoading: false,
    error: null,
    generatedAt: null,
  })

  const generate = React.useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: bodyOverride ? JSON.stringify(bodyOverride) : undefined,
      })
      const data = await response.json()
      if (data.success) {
        setState({
          content: data.analysis || data.recommendations || data.insights,
          isLoading: false,
          error: null,
          generatedAt: data.generatedAt,
        })
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || "Failed to generate",
        }))
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Network error",
      }))
    }
  }, [endpoint, bodyOverride])

  return { ...state, generate }
}

export default function AiInsightsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  const analysis = useAiInsight("/api/ai/analyze")
  const monthlyRecs = useAiInsight("/api/ai/recommendations", { period: "monthly" })
  const weeklyRecs = useAiInsight("/api/ai/recommendations", { period: "weekly" })
  const sipInsights = useAiInsight("/api/ai/sip-insights")

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
          title="AI Recommendations"
          subtitle="AI-powered spending analysis, budget recommendations, and investment insights"
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-6">
            <Tabs defaultValue="analysis" className="space-y-4">
              <TabsList className="flex flex-wrap gap-2">
                <TabsTrigger value="analysis">
                  <IconReportAnalytics className="mr-1 h-4 w-4" />
                  Spending Analysis
                </TabsTrigger>
                <TabsTrigger value="monthly">
                  <IconTargetArrow className="mr-1 h-4 w-4" />
                  Monthly Budget
                </TabsTrigger>
                <TabsTrigger value="weekly">
                  <IconTargetArrow className="mr-1 h-4 w-4" />
                  Weekly Budget
                </TabsTrigger>
                <TabsTrigger value="investments">
                  <IconChartPie className="mr-1 h-4 w-4" />
                  Investment Insights
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analysis">
                <InsightCard
                  title="Spending Analysis"
                  description="AI-powered analysis of your spending patterns and financial health"
                  icon={<IconReportAnalytics className="h-5 w-5 text-blue-500" />}
                  state={analysis}
                  onGenerate={analysis.generate}
                />
              </TabsContent>

              <TabsContent value="monthly">
                <InsightCard
                  title="Monthly Budget Recommendations"
                  description="Personalized budget allocation for the upcoming month"
                  icon={<IconTargetArrow className="h-5 w-5 text-emerald-500" />}
                  state={monthlyRecs}
                  onGenerate={monthlyRecs.generate}
                />
              </TabsContent>

              <TabsContent value="weekly">
                <InsightCard
                  title="Weekly Budget Recommendations"
                  description="Short-term spending targets for the coming week"
                  icon={<IconTargetArrow className="h-5 w-5 text-amber-500" />}
                  state={weeklyRecs}
                  onGenerate={weeklyRecs.generate}
                />
              </TabsContent>

              <TabsContent value="investments">
                <InsightCard
                  title="Investment Insights"
                  description="AI analysis of your SIPs, stocks, and mutual fund portfolio"
                  icon={<IconChartPie className="h-5 w-5 text-purple-500" />}
                  state={sipInsights}
                  onGenerate={sipInsights.generate}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function InsightCard({
  title,
  description,
  icon,
  state,
  onGenerate,
}: {
  title: string
  description: string
  icon: React.ReactNode
  state: InsightSection
  onGenerate: () => void
}) {
  return (
    <Card className="border border-border/70">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Button
          variant={state.content ? "outline" : "default"}
          size="sm"
          onClick={onGenerate}
          disabled={state.isLoading}
        >
          {state.isLoading ? (
            <IconRefresh className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <IconSparkles className="mr-1 h-4 w-4" />
          )}
          {state.content ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {state.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : state.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {state.error}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ensure OPENROUTER_API_KEY is set in your .env.local file.
            </p>
          </div>
        ) : state.content ? (
          <div className="space-y-2">
            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed [&>h1]:text-lg [&>h2]:mt-4 [&>h2]:text-base [&>h2]:font-semibold [&>h3]:text-sm [&>h3]:font-semibold [&>ul]:my-2 [&>ol]:my-2 [&>p]:my-2">
              <MarkdownRenderer content={state.content} />
            </div>
            {state.generatedAt && (
              <div className="flex items-center gap-2 border-t pt-3 mt-4">
                <Badge variant="secondary" className="text-xs">
                  <IconSparkles className="mr-1 h-3 w-3" />
                  AI Generated
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(state.generatedAt).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconSparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Click Generate to get AI-powered {title.toLowerCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This uses your transaction data to provide personalized recommendations
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
          <span className="shrink-0 text-muted-foreground">-</span>
          <span dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(2)) }} />
        </div>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, "")
      const num = trimmed.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="shrink-0 text-muted-foreground">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />
        </div>
      )
    } else {
      elements.push(
        <p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
      )
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
