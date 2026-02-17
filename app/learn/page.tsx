"use client"

import * as React from "react"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import {
  IconSchool,
  IconBulb,
  IconShieldCheck,
  IconChartLine,
  IconBuildingBank,
  IconCoins,
  IconPigMoney,
  IconCalculator,
  IconTarget,
  IconWallet,
  IconTrendingUp,
  IconChartDonut,
  IconCash,
  IconReceipt,
  IconSearch,
  IconCheck,
  IconChevronDown,
  IconBookmark,
  IconClock,
  IconStar,
  IconArrowRight,
  IconFlame,
  IconScale,
  IconX,
  IconSparkles,
  IconMoodSmile,
  IconTrophy,
  IconRocket,
  IconBrain,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconArrowLeft,
  IconFilter,
} from "@tabler/icons-react"

import { stagger, staggerSlow, fadeUp, fadeUpSmall, spring } from "@/lib/motion"
import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  TOPICS,
  TOPICS_MAP,
  SECTIONS,
  TOPIC_CONTENT,
  TOPIC_QUIZZES,
  type LearnSection,
} from "@/lib/learn-content"
import type { LearnProgress, QuizQuestion } from "@/lib/learn-types"

/* ─── Icon map ─── */

const ICON_MAP: Record<string, React.ElementType> = {
  IconSchool,
  IconBulb,
  IconShieldCheck,
  IconChartLine,
  IconBuildingBank,
  IconCoins,
  IconPigMoney,
  IconCalculator,
  IconTarget,
  IconWallet,
  IconTrendingUp,
  IconChartDonut,
  IconCash,
  IconReceipt,
  IconFlame,
  IconScale,
}

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] || IconBulb
}

/* ─── Difficulty helpers ─── */

type Difficulty = "beginner" | "intermediate" | "advanced"

function difficultyColor(d: Difficulty) {
  switch (d) {
    case "beginner":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    case "intermediate":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    case "advanced":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  }
}

function difficultyIconBg(d: Difficulty) {
  switch (d) {
    case "beginner":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    case "intermediate":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
    case "advanced":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  }
}

function difficultyLabel(d: Difficulty) {
  return d.charAt(0).toUpperCase() + d.slice(1)
}

/* ─── Status helpers ─── */

type ProgressStatus = "unread" | "read" | "quizzed" | "mastered"

function statusBadge(status: ProgressStatus) {
  switch (status) {
    case "mastered":
      return { label: "Mastered", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: IconTrophy }
    case "quizzed":
      return { label: "Quizzed", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: IconBrain }
    case "read":
      return { label: "Read", className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20", icon: IconCheck }
    default:
      return null
  }
}

/* ─── Progress motivational copy ─── */

function getMotivationalCopy(percent: number, readCount: number): { text: string; icon: React.ElementType } {
  if (readCount === 0) return { text: "Begin your journey to financial mastery", icon: IconRocket }
  if (percent === 100) return { text: "You have mastered every topic. Brilliant.", icon: IconTrophy }
  if (percent >= 75) return { text: "Almost there! Just a few topics left to conquer", icon: IconSparkles }
  if (percent >= 50) return { text: "Halfway through! Your financial IQ is growing fast", icon: IconTrendingUp }
  if (percent >= 25) return { text: "Great momentum! Keep exploring to level up", icon: IconMoodSmile }
  return { text: "You are off to a strong start. Keep going!", icon: IconFlame }
}

/* ─── Hooks ─── */

function useLearnProgress() {
  return useQuery<LearnProgress[]>({
    queryKey: ["learn-progress"],
    queryFn: async () => {
      const res = await fetch("/api/learn/progress")
      if (!res.ok) throw new Error("Failed to fetch progress")
      const data = await res.json()
      return data.progress || []
    },
    staleTime: 30_000,
  })
}

interface InvestmentCheckResponse {
  hasStocks: boolean
  hasMutualFunds: boolean
  hasSips: boolean
}

function useInvestmentCheck() {
  return useQuery<InvestmentCheckResponse>({
    queryKey: ["learn-investment-check"],
    queryFn: async () => {
      const [stocksRes, mfRes, sipsRes] = await Promise.all([
        fetch("/api/stocks").then((r) => (r.ok ? r.json() : { success: false })),
        fetch("/api/mutual-funds").then((r) => (r.ok ? r.json() : { success: false })),
        fetch("/api/sips").then((r) => (r.ok ? r.json() : { success: false })),
      ])
      return {
        hasStocks: stocksRes.success && Array.isArray(stocksRes.items) && stocksRes.items.length > 0,
        hasMutualFunds: mfRes.success && Array.isArray(mfRes.items) && mfRes.items.length > 0,
        hasSips: sipsRes.success && Array.isArray(sipsRes.items) && sipsRes.items.length > 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface FinancialHealthData {
  success: boolean
  metrics?: {
    emergencyFundMonths: number
    financialFreedomScore: number
  }
}

function useFinancialHealthForLearn() {
  return useQuery<FinancialHealthData>({
    queryKey: ["financial-health"],
    queryFn: async () => {
      const res = await fetch("/api/financial-health")
      if (!res.ok) throw new Error("Failed to fetch financial health")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Recommendation engine ─── */

interface Recommendation {
  topicId: string
  reason: string
}

function buildRecommendations(
  healthData: FinancialHealthData | undefined,
  investmentData: InvestmentCheckResponse | undefined,
  progressMap: Map<string, LearnProgress>,
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const healthScore = healthData?.metrics?.financialFreedomScore
  const emergencyMonths = healthData?.metrics?.emergencyFundMonths ?? 0
  const hasAnyInvestments =
    investmentData?.hasStocks || investmentData?.hasMutualFunds || investmentData?.hasSips

  // Only recommend topics that are not yet mastered
  const isNotMastered = (id: string) => {
    const p = progressMap.get(id)
    return !p || p.status !== "mastered"
  }

  if (healthScore !== undefined && healthScore < 30) {
    if (isNotMastered("budgeting-methods")) {
      recommendations.push({
        topicId: "budgeting-methods",
        reason: `Your financial health score is ${Math.round(healthScore)}. Budgeting is the fastest way to improve it.`,
      })
    }
    if (isNotMastered("savings-rate")) {
      recommendations.push({
        topicId: "savings-rate",
        reason: `With a health score of ${Math.round(healthScore)}, boosting your savings rate will have the biggest impact.`,
      })
    }
  }

  if (investmentData && !hasAnyInvestments) {
    if (isNotMastered("what-is-investing")) {
      recommendations.push({
        topicId: "what-is-investing",
        reason: "You have not added any investments yet. Start here to understand the basics.",
      })
    }
    if (isNotMastered("sip")) {
      recommendations.push({
        topicId: "sip",
        reason: "SIPs are the easiest way to start investing with small amounts every month.",
      })
    }
  }

  if (healthData?.metrics && emergencyMonths < 3 && isNotMastered("emergency-fund")) {
    const monthsText =
      emergencyMonths < 1
        ? "less than 1 month"
        : `about ${Math.round(emergencyMonths)} month${Math.round(emergencyMonths) === 1 ? "" : "s"}`
    recommendations.push({
      topicId: "emergency-fund",
      reason: `Your emergency fund covers ${monthsText} of expenses. Experts recommend at least 3-6 months.`,
    })
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique: Recommendation[] = []
  for (const rec of recommendations) {
    if (!seen.has(rec.topicId)) {
      seen.add(rec.topicId)
      unique.push(rec)
    }
  }

  if (unique.length > 0) return unique.slice(0, 3)

  // Default recommendations for unmastered beginner topics
  const defaults = ["what-is-investing", "emergency-fund", "budgeting-methods"]
  return defaults
    .filter(isNotMastered)
    .slice(0, 3)
    .map((id) => ({
      topicId: id,
      reason:
        id === "what-is-investing"
          ? "A great starting point for building wealth over time."
          : id === "emergency-fund"
          ? "The foundation of every solid financial plan."
          : "Learn proven techniques to manage your money better.",
    }))
}

/* ─── Quiz component ─── */

function QuizSection({
  topicId,
  questions,
  onComplete,
}: {
  topicId: string
  questions: QuizQuestion[]
  onComplete: (status: ProgressStatus, score: number) => void
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => new Array(questions.length).fill(null)
  )
  const [result, setResult] = useState<{
    score: number
    total: number
    passed: boolean
    explanations: { question: string; correct: boolean; correctIndex: number; explanation: string }[]
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const allAnswered = answers.every((a) => a !== null)

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/learn/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, answers }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({
          score: data.score,
          total: data.total,
          passed: data.passed,
          explanations: data.explanations,
        })
        onComplete(data.status, data.score)
      }
    } catch (err) {
      console.error("Quiz submit failed:", err)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className={`rounded-xl border p-4 ${result.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <div className="flex items-center gap-3 mb-2">
            {result.passed ? (
              <IconTrophy className="h-5 w-5 text-emerald-500" />
            ) : (
              <IconBrain className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {result.passed ? "Mastered!" : "Keep Learning"}
              </h4>
              <p className="text-xs text-muted-foreground">
                You scored {result.score}/{result.total} ({Math.round((result.score / result.total) * 100)}%)
                {result.passed ? " — Topic mastered!" : " — Score 80%+ to master this topic."}
              </p>
            </div>
          </div>
        </div>

        {result.explanations.map((exp, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 ${exp.correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
          >
            <div className="flex items-start gap-2 mb-1.5">
              {exp.correct ? (
                <IconCircleCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <IconCircleX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              )}
              <p className="text-xs font-medium text-foreground">{exp.question}</p>
            </div>
            <p className="text-xs text-muted-foreground ml-6">{exp.explanation}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg border border-border/50 p-4">
          <p className="text-sm font-medium text-foreground mb-3">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => {
                  const next = [...answers]
                  next[qi] = oi
                  setAnswers(next)
                }}
                className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all duration-150 ${
                  answers[qi] === oi
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/40 bg-card/50 text-muted-foreground hover:border-border hover:bg-accent/30"
                }`}
              >
                <span className="font-medium mr-2">
                  {String.fromCharCode(65 + oi)}.
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
          allAnswered && !submitting
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <IconCheck className="h-4 w-4" />
            Submit Answers
          </>
        )}
      </button>
    </div>
  )
}

/* ─── Topic detail view ─── */

function TopicDetailView({
  topicId,
  progress,
  onBack,
  onProgressUpdate,
}: {
  topicId: string
  progress: LearnProgress | undefined
  onBack: () => void
  onProgressUpdate: (topicId: string, status: ProgressStatus, score?: number) => void
}) {
  const topic = TOPICS_MAP.get(topicId)
  const content = TOPIC_CONTENT[topicId]
  const quiz = TOPIC_QUIZZES[topicId]
  const [aiContent, setAiContent] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Mark as read on mount (if not already)
  useEffect(() => {
    if (!progress || progress.status === "unread") {
      fetch("/api/learn/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, status: "read" }),
      }).then(() => {
        onProgressUpdate(topicId, "read")
      }).catch(() => {})
    }
  }, [topicId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!topic) return null

  const TopicIcon = getIcon(topic.icon)
  const badge = statusBadge(progress?.status || "unread")

  const handlePersonalize = async () => {
    setAiLoading(true)
    setShowAi(true)
    try {
      const res = await fetch("/api/learn/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      })
      const data = await res.json()
      if (data.success) {
        setAiContent(data.content)
      }
    } catch (err) {
      console.error("AI generation failed:", err)
    } finally {
      setAiLoading(false)
    }
  }

  const handleQuizComplete = (status: ProgressStatus, score: number) => {
    onProgressUpdate(topicId, status, score)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
        >
          <IconArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${difficultyIconBg(topic.difficulty)}`}>
              <TopicIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground leading-tight">{topic.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[8px] font-semibold uppercase tracking-wider ${difficultyColor(topic.difficulty)}`}>
                  {difficultyLabel(topic.difficulty)}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
                  <IconClock className="h-2.5 w-2.5" />
                  {topic.readTime} read
                </span>
                {badge && (
                  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0 text-[8px] font-semibold uppercase tracking-wider ${badge.className}`}>
                    <badge.icon className="h-2.5 w-2.5" />
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content card */}
      <div className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 card-elevated overflow-hidden">
        <div className="p-5 md:p-6" ref={contentRef}>
          {/* Static content */}
          <div className="prose-finance prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-5 mb-2 first:mt-0">{children}</h3>,
                h3: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-3 mb-1.5">{children}</h4>,
                p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>,
                ul: ({ children }) => <ul className="text-sm text-muted-foreground leading-relaxed mb-2 ml-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm text-muted-foreground leading-relaxed mb-2 ml-4 space-y-1 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="list-disc">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="border-b border-border/60">{children}</thead>,
                th: ({ children }) => <th className="text-left px-2 py-1.5 text-foreground font-semibold">{children}</th>,
                td: ({ children }) => <td className="px-2 py-1.5 text-muted-foreground border-t border-border/30">{children}</td>,
                blockquote: ({ children }) => (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                    <div className="text-sm text-muted-foreground leading-relaxed [&>p]:mb-0">{children}</div>
                  </div>
                ),
              }}
            >
              {content || "Content not available."}
            </ReactMarkdown>
          </div>

          {/* AI Personalization */}
          <div className="mt-6 pt-5 border-t border-border/30">
            {!showAi ? (
              <button
                onClick={handlePersonalize}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
              >
                <IconSparkles className="h-4 w-4" />
                Personalize with AI
              </button>
            ) : aiLoading ? (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <IconLoader2 className="h-5 w-5 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-medium text-foreground">Generating personalized lesson...</p>
                  <p className="text-xs text-muted-foreground">Using your financial data to create tailored examples and advice</p>
                </div>
              </div>
            ) : aiContent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconSparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Your Personalized Lesson</h4>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                  <div className="prose-finance prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5 first:mt-0">{children}</h3>,
                        h3: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-3 mb-1.5">{children}</h4>,
                        p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="text-sm text-muted-foreground leading-relaxed mb-2 ml-4 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="text-sm text-muted-foreground leading-relaxed mb-2 ml-4 space-y-1 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="list-disc">{children}</li>,
                        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                        blockquote: ({ children }) => (
                          <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
                            <div className="text-sm text-muted-foreground leading-relaxed [&>p]:mb-0">{children}</div>
                          </div>
                        ),
                      }}
                    >
                      {aiContent}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Quiz section */}
          {quiz && quiz.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <IconBrain className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Test Your Knowledge</h4>
                <span className="text-[11px] text-muted-foreground">
                  {quiz.length} question{quiz.length > 1 ? "s" : ""} — Score 80%+ to master
                </span>
              </div>
              <QuizSection
                topicId={topicId}
                questions={quiz}
                onComplete={handleQuizComplete}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Topic card for grid view ─── */

function TopicGridCard({
  topicId,
  progress,
  onClick,
}: {
  topicId: string
  progress: LearnProgress | undefined
  onClick: () => void
}) {
  const topic = TOPICS_MAP.get(topicId)
  if (!topic) return null

  const TopicIcon = getIcon(topic.icon)
  const badge = statusBadge(progress?.status || "unread")
  const hasQuiz = !!TOPIC_QUIZZES[topicId]

  return (
    <motion.button
      variants={fadeUpSmall}
      onClick={onClick}
      className="group relative text-left rounded-xl border border-border/50 bg-card/80 hover:bg-accent/30 hover:border-border transition-all duration-200 overflow-hidden"
    >
      {badge && (
        <div className="absolute top-0 right-0">
          <div className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg border-b border-l ${badge.className}`}>
            {badge.label}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-3 mb-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${difficultyIconBg(topic.difficulty)} transition-transform duration-200 group-hover:scale-105`}>
            <TopicIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 pr-12">
            <h3 className={`text-sm font-medium leading-tight truncate ${progress?.status && progress.status !== "unread" ? "text-muted-foreground" : "text-foreground"}`}>
              {topic.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[8px] font-semibold uppercase tracking-wider ${difficultyColor(topic.difficulty)}`}>
                {difficultyLabel(topic.difficulty)}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
                <IconClock className="h-2.5 w-2.5" />
                {topic.readTime}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-2">
          {topic.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {hasQuiz && (
              <span className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider flex items-center gap-1">
                <IconBrain className="h-2.5 w-2.5" />
                Quiz
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span>Read</span>
            <IconArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </motion.button>
  )
}

/* ─── Recommended section ─── */

function RecommendedSection({
  recommendations,
  isLoading,
  onTopicClick,
  progressMap,
}: {
  recommendations: Recommendation[]
  isLoading: boolean
  onTopicClick: (topicId: string) => void
  progressMap: Map<string, LearnProgress>
}) {
  if (isLoading) {
    return (
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3">
          <IconSparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recommended for you</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-muted/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-muted/60" />
                  <div className="h-2.5 w-1/3 rounded bg-muted/40" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded bg-muted/40" />
                <div className="h-2.5 w-4/5 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  if (recommendations.length === 0) return null

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center gap-2 mb-3">
        <IconSparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Recommended for you</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec, idx) => {
          const topic = TOPICS_MAP.get(rec.topicId)
          if (!topic) return null
          const TopicIcon = getIcon(topic.icon)
          const progress = progressMap.get(rec.topicId)
          const isRead = progress && progress.status !== "unread"

          return (
            <motion.button
              key={rec.topicId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => onTopicClick(rec.topicId)}
              className="group relative text-left rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent hover:from-primary/[0.08] hover:border-primary/30 transition-all duration-200 overflow-hidden"
            >
              <div className="absolute top-0 right-0">
                <div className="bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-lg border-b border-l border-primary/15">
                  Recommended
                </div>
              </div>

              <div className="p-4 pt-3">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${difficultyIconBg(topic.difficulty)} transition-transform duration-200 group-hover:scale-105`}>
                    <TopicIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 pr-16">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`text-sm font-medium leading-tight truncate ${isRead ? "text-muted-foreground" : "text-foreground"}`}>
                        {topic.title}
                      </h3>
                      {isRead && (
                        <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                          <IconCheck className="h-2 w-2 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[8px] font-semibold uppercase tracking-wider ${difficultyColor(topic.difficulty)}`}>
                        {difficultyLabel(topic.difficulty)}
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
                        <IconClock className="h-2.5 w-2.5" />
                        {topic.readTime}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
                  {rec.reason}
                </p>

                <div className="flex items-center gap-1 mt-2.5 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span>Read lesson</span>
                  <IconArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ─── Section block for grid view ─── */

function SectionGridBlock({
  section,
  progressMap,
  onTopicClick,
  defaultOpen,
}: {
  section: LearnSection
  progressMap: Map<string, LearnProgress>
  onTopicClick: (topicId: string) => void
  defaultOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const SectionIcon = getIcon(section.icon)

  const sectionTopics = section.topicIds.map((id) => TOPICS_MAP.get(id)).filter(Boolean)
  const readCount = section.topicIds.filter((id) => {
    const p = progressMap.get(id)
    return p && p.status !== "unread"
  }).length
  const total = sectionTopics.length
  const percent = total > 0 ? Math.round((readCount / total) * 100) : 0

  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group/section w-full text-left rounded-2xl p-4 transition-all duration-200 bg-gradient-to-r ${section.accentBg} border border-border/40 hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${section.gradient} text-white shadow-sm shrink-0`}>
            <SectionIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              {percent === 100 && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/25">
                  <IconCheck className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-muted-foreground">
                {readCount} of {total} completed
              </p>
              <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${section.gradient}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </div>
          </div>
          <div className={`shrink-0 text-muted-foreground/40 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
            <IconChevronDown className="h-5 w-5" />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {section.topicIds.map((id) => (
                <TopicGridCard
                  key={id}
                  topicId={id}
                  progress={progressMap.get(id)}
                  onClick={() => onTopicClick(id)}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Main page ─── */

export default function LearnPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all")
  const searchRef = useRef<HTMLInputElement>(null)

  // Data fetching
  const { data: progressData, refetch: refetchProgress } = useLearnProgress()
  const { data: healthData, isLoading: isHealthLoading } = useFinancialHealthForLearn()
  const { data: investmentData, isLoading: isInvestmentLoading } = useInvestmentCheck()

  // Progress map
  const progressMap = useMemo(() => {
    const map = new Map<string, LearnProgress>()
    if (progressData) {
      for (const p of progressData) {
        map.set(p.topicId, p)
      }
    }
    return map
  }, [progressData])

  // Recommendations
  const isRecsLoading = isHealthLoading || isInvestmentLoading
  const recommendations = useMemo(
    () => (isRecsLoading ? [] : buildRecommendations(healthData, investmentData, progressMap)),
    [isRecsLoading, healthData, investmentData, progressMap],
  )

  // Progress stats
  const completedCount = useMemo(() => {
    let count = 0
    for (const topic of TOPICS) {
      const p = progressMap.get(topic.id)
      if (p && p.status !== "unread") count++
    }
    return count
  }, [progressMap])

  const masteredCount = useMemo(() => {
    let count = 0
    for (const topic of TOPICS) {
      const p = progressMap.get(topic.id)
      if (p && p.status === "mastered") count++
    }
    return count
  }, [progressMap])

  const totalTopics = TOPICS.length
  const progressPercent = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0
  const motivational = getMotivationalCopy(progressPercent, completedCount)
  const MotivIcon = motivational.icon

  // Filtered sections
  const filteredSections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return SECTIONS.map((section) => ({
      ...section,
      topicIds: section.topicIds.filter((id) => {
        const topic = TOPICS_MAP.get(id)
        if (!topic) return false
        if (difficultyFilter !== "all" && topic.difficulty !== difficultyFilter) return false
        if (!query) return true
        return (
          topic.title.toLowerCase().includes(query) ||
          topic.description.toLowerCase().includes(query) ||
          topic.tags.some((t) => t.toLowerCase().includes(query))
        )
      }),
    })).filter((s) => s.topicIds.length > 0)
  }, [searchQuery, difficultyFilter])

  // Handle progress updates from detail view
  const handleProgressUpdate = useCallback(
    (topicId: string, status: ProgressStatus, score?: number) => {
      refetchProgress()
    },
    [refetchProgress],
  )

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login")
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) return null

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Learn" subtitle="Master your financial knowledge" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6">
            <AnimatePresence mode="wait">
              {selectedTopic ? (
                <TopicDetailView
                  key={selectedTopic}
                  topicId={selectedTopic}
                  progress={progressMap.get(selectedTopic)}
                  onBack={() => setSelectedTopic(null)}
                  onProgressUpdate={handleProgressUpdate}
                />
              ) : (
                <motion.div
                  key="grid"
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-6"
                >
                  {/* Hero / Progress Section */}
                  <motion.div variants={fadeUp} className="relative">
                    <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/10 via-cyan-500/8 to-emerald-500/10 blur-2xl opacity-50 pointer-events-none" />
                    <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/60 card-elevated overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-primary/60 via-cyan-500/60 to-emerald-500/60" />
                      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
                        <svg width="100%" height="100%">
                          <pattern id="learn-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="20" cy="20" r="1" fill="currentColor" />
                          </pattern>
                          <rect width="100%" height="100%" fill="url(#learn-grid)" />
                        </svg>
                      </div>

                      <div className="relative p-6 md:p-8">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-primary/10">
                                <IconSchool className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                                  Financial Academy
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {totalTopics} bite-sized lessons across {SECTIONS.length} modules
                                </p>
                              </div>
                            </div>

                            <motion.div variants={fadeUpSmall} className="flex items-center gap-2 mt-4 mb-5">
                              <MotivIcon className="h-4 w-4 text-primary shrink-0" />
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {motivational.text}
                              </p>
                            </motion.div>

                            <div className="max-w-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {completedCount} of {totalTopics} read
                                  {masteredCount > 0 && ` · ${masteredCount} mastered`}
                                </span>
                                <span className="text-xs font-bold tabular-nums text-foreground">
                                  {progressPercent}%
                                </span>
                              </div>
                              <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-500 to-emerald-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercent}%` }}
                                  transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Donut ring */}
                          <div className="shrink-0 self-center">
                            <div className="relative flex items-center justify-center h-28 w-28 md:h-32 md:w-32">
                              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 to-emerald-500/10 blur-md" />
                              <svg className="h-full w-full -rotate-90 relative" viewBox="0 0 100 100">
                                <circle
                                  cx="50" cy="50" r="40"
                                  fill="none" stroke="currentColor" strokeWidth="6"
                                  className="text-muted/30"
                                />
                                <circle
                                  cx="50" cy="50" r="40"
                                  fill="none" strokeWidth="6"
                                  stroke="url(#heroProgressGradient)"
                                  strokeLinecap="round"
                                  strokeDasharray={`${(progressPercent / 100) * 251.33} 251.33`}
                                  className="transition-all duration-700 ease-out"
                                />
                                <defs>
                                  <linearGradient id="heroProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="oklch(0.55 0.12 145)" />
                                    <stop offset="50%" stopColor="rgb(6 182 212)" />
                                    <stop offset="100%" stopColor="rgb(16 185 129)" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-2xl md:text-3xl font-extrabold tabular-nums text-foreground leading-none">
                                  {progressPercent}
                                </span>
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                                  percent
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {completedCount === totalTopics && totalTopics > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5, ...spring.smooth }}
                            className="flex items-center gap-2.5 mt-5 pt-4 border-t border-border/40"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                              <IconTrophy className="h-4 w-4 text-emerald-500" />
                            </div>
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              Congratulations! You have completed all topics. You are now financially literate.
                            </span>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Search + filter */}
                  <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative group/search flex-1">
                      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-primary/10 opacity-0 group-focus-within/search:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative flex items-center rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm card-elevated transition-all duration-200 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/15">
                        <IconSearch className="ml-4 h-[18px] w-[18px] text-muted-foreground/50 shrink-0" />
                        <input
                          ref={searchRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search topics... (e.g., SIP, tax, FIRE, mutual funds)"
                          className="h-12 flex-1 bg-transparent pl-3 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => {
                              setSearchQuery("")
                              searchRef.current?.focus()
                            }}
                            className="mr-3 flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <IconX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Difficulty filter */}
                    <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 px-2 h-12">
                      <IconFilter className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficultyFilter(d)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 ${
                            difficultyFilter === d
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          {d === "all" ? "All" : difficultyLabel(d)}
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  {/* Recommended */}
                  {!searchQuery && difficultyFilter === "all" && (
                    <RecommendedSection
                      recommendations={recommendations}
                      isLoading={isRecsLoading}
                      onTopicClick={setSelectedTopic}
                      progressMap={progressMap}
                    />
                  )}

                  {/* Empty state */}
                  {filteredSections.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={spring.smooth}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="relative mb-5">
                        <div className="absolute -inset-4 rounded-full border border-border/30 animate-pulse" />
                        <div className="absolute -inset-8 rounded-full border border-border/15" />
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 border border-border/40">
                          <IconSearch className="h-7 w-7 text-muted-foreground/30" />
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-1.5">No topics found</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                        No results for &quot;{searchQuery}&quot;. Try a different keyword or browse all topics.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("")
                          setDifficultyFilter("all")
                          searchRef.current?.focus()
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
                      >
                        <IconX className="h-3.5 w-3.5" />
                        Clear filters
                      </button>
                    </motion.div>
                  )}

                  {/* Sections */}
                  <motion.div
                    variants={staggerSlow}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col gap-5"
                  >
                    {filteredSections.map((section) => (
                      <SectionGridBlock
                        key={section.id}
                        section={section}
                        progressMap={progressMap}
                        onTopicClick={setSelectedTopic}
                        defaultOpen
                      />
                    ))}
                  </motion.div>

                  {/* Footer */}
                  {filteredSections.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.45 }}
                      className="relative overflow-hidden"
                    >
                      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500/8 via-orange-500/5 to-rose-500/8 blur-xl opacity-50 pointer-events-none" />
                      <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-amber-500/15 card-elevated overflow-hidden">
                        <div className="h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                        <div className="p-6">
                          <div className="absolute top-4 right-5 text-amber-400/15">
                            <IconStar className="h-6 w-6" />
                          </div>
                          <div className="absolute top-10 right-14 text-amber-400/10">
                            <IconStar className="h-3.5 w-3.5" />
                          </div>
                          <div className="absolute bottom-5 right-8 text-amber-400/8">
                            <IconSparkles className="h-4 w-4" />
                          </div>
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/10">
                              <IconBookmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-[15px] font-semibold text-foreground mb-1.5">
                                Knowledge is Your Best Investment
                              </h3>
                              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                                Warren Buffett spends 80% of his day reading. The more you understand about
                                money, the better decisions you will make. Come back to these topics whenever
                                you need a refresher. Your progress is saved to your account.
                              </p>
                              <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium group/cta cursor-default">
                                <span>Keep learning</span>
                                <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
