"use client"

import * as React from "react"
import { useEffect, useRef, useState, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  IconRobot,
  IconSend2,
  IconPlayerStop,
  IconSparkles,
  IconUser,
  IconTrash,
  IconWallet,
  IconChartLine,
  IconTarget,
  IconReceipt,
  IconBulb,
  IconHeartbeat,
  IconMessageCircle,
  IconHistory,
  IconPlus,
  IconX,
  IconMenu2,
} from "@tabler/icons-react"

import Lottie from "lottie-react"
import { useAuth } from "@/hooks/use-auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/* ─── Types ─── */

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ThreadSummary {
  threadId: string
  title: string
  preview: string
  updatedAt: string
  messageCount: number
}

interface ThreadFull {
  threadId: string
  title: string
  messages: { role: "user" | "assistant"; content: string; timestamp: string }[]
  createdAt: string
  updatedAt: string
}

/* ─── Quick actions ─── */

const quickActions = [
  {
    icon: IconWallet,
    label: "Spending summary",
    prompt:
      "Give me a summary of my spending patterns this month. What are my top expense categories and how do they compare to my budget?",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/8",
  },
  {
    icon: IconChartLine,
    label: "Investment review",
    prompt:
      "Review my investment portfolio. How are my stocks, mutual funds, and SIPs performing? Any recommendations?",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/8",
  },
  {
    icon: IconTarget,
    label: "FIRE progress",
    prompt:
      "Based on my current savings rate and investments, how am I progressing toward financial independence? What's my estimated FIRE number and years to reach it?",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/8",
  },
  {
    icon: IconReceipt,
    label: "Budget check",
    prompt:
      "Am I on track with my budgets this month? Which categories am I overspending in and where can I save more?",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/8",
  },
  {
    icon: IconBulb,
    label: "Save more tips",
    prompt:
      "Analyze my spending and give me 5 specific, actionable tips to save more money based on my actual transaction patterns.",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/8",
  },
  {
    icon: IconHeartbeat,
    label: "Financial health",
    prompt:
      "Give me an honest assessment of my financial health. Cover emergency fund, savings rate, investment rate, and what I should prioritize improving.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/8",
  },
]

/* ─── Markdown components for react-markdown ─── */

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-bold mt-3 mb-1.5 text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mt-2.5 mb-1 text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[13px] leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 ml-4 space-y-0.5 list-disc text-[13px] leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-4 space-y-0.5 list-decimal text-[13px] leading-relaxed">{children}</ol>
  ),
  li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  pre: ({ children }) => (
    <pre className="my-2 rounded-xl bg-muted/60 p-3.5 overflow-x-auto text-[12px] leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    if (className) {
      return (
        <code className="font-mono" {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-mono"
        {...props}
      >
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-border/30">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border/40" />,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
}

/* ─── Thinking dots ─── */

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary/50"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

/* ─── Memoized chat bubble (prevents re-render of completed messages) ─── */

const ChatBubble = memo(function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant"
  content: string
}) {
  const isUser = role === "user"

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
          isUser
            ? "bg-foreground/8"
            : "bg-gradient-to-br from-primary to-chart-2"
        }`}
      >
        {isUser ? (
          <IconUser className="h-3.5 w-3.5 text-foreground/60" />
        ) : (
          <IconRobot className="h-3.5 w-3.5 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border/50 rounded-bl-md card-elevated"
        }`}
      >
        {isUser ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        ) : content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={mdComponents}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <ThinkingDots />
        )}
      </div>
    </div>
  )
})

/* ─── Animated hero orb (replace with Lottie when file is provided) ─── */

function HeroOrb() {
  return (
    <div className="relative h-28 w-28">
      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/25 via-chart-2/15 to-chart-3/10 blur-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Outer ring */}
      <motion.div
        className="absolute inset-1 rounded-full border border-primary/15"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary/40" />
      </motion.div>
      {/* Main orb */}
      <motion.div
        className="absolute inset-3 rounded-full bg-gradient-to-br from-primary via-primary/90 to-chart-2 shadow-xl shadow-primary/20"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glass highlight */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tl from-transparent via-white/15 to-white/25" />
        <div className="flex h-full items-center justify-center">
          <IconRobot className="h-11 w-11 text-white/90" stroke={1.5} />
        </div>
      </motion.div>
      {/* Sparkle badge */}
      <motion.div
        className="absolute -right-0.5 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-chart-3 to-amber-400 shadow-lg shadow-amber-400/25 border-2 border-background"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <IconSparkles className="h-3.5 w-3.5 text-white" />
      </motion.div>
    </div>
  )
}

/* ─── Strip markdown for preview text ─── */

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, (match) => match.replace(/`/g, ''))
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .trim()
}

/* ─── Thread list item ─── */

const ThreadItem = memo(function ThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
}: {
  thread: ThreadSummary
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const relativeDate = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })
    } catch {
      return ""
    }
  }, [thread.updatedAt])

  return (
    <div
      className={`group relative flex flex-col gap-1 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50 border border-transparent"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-foreground leading-tight line-clamp-1 flex-1">
          {thread.title}
        </p>
        {confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                onDelete()
                setConfirmDelete(false)
              }}
              className="text-[11px] text-destructive hover:text-destructive/80 font-medium px-1"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(true)
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
          >
            <IconTrash className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-1">
        {stripMarkdown(thread.preview)}
      </p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
        <span>{relativeDate}</span>
        <span className="text-muted-foreground/30">|</span>
        <span>{thread.messageCount} messages</span>
      </div>
    </div>
  )
})

/* ─── Thread sidebar content (shared between desktop panel and mobile sheet) ─── */

function ThreadSidebarContent({
  threads,
  isLoading,
  currentThreadId,
  onSelectThread,
  onDeleteThread,
  onNewChat,
}: {
  threads: ThreadSummary[]
  isLoading: boolean
  currentThreadId: string | null
  onSelectThread: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onNewChat: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="p-3 border-b border-border/40">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary px-3 py-2 text-[12px] font-medium transition-colors"
        >
          <IconPlus className="h-3.5 w-3.5" />
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-muted rounded w-3/4 mb-1.5" />
                <div className="h-2.5 bg-muted/60 rounded w-full mb-1" />
                <div className="h-2 bg-muted/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <IconHistory className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-[12px] text-muted-foreground/60">
              No conversations yet
            </p>
            <p className="text-[11px] text-muted-foreground/40 mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.threadId}
              thread={thread}
              isActive={thread.threadId === currentThreadId}
              onSelect={() => onSelectThread(thread.threadId)}
              onDelete={() => onDeleteThread(thread.threadId)}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ─── Main page ─── */

export default function AgentPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lottieData, setLottieData] = useState<any>(null)
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [threadPanelOpen, setThreadPanelOpen] = useState(false)
  const [threadSidebarVisible, setThreadSidebarVisible] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const userScrolledUpRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const chatStarted = messages.length > 0

  // ── Fetch thread list ──
  const {
    data: threadsData,
    isLoading: threadsLoading,
  } = useQuery({
    queryKey: ["agent-threads"],
    queryFn: async (): Promise<ThreadSummary[]> => {
      const res = await fetch("/api/agent/threads", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch threads")
      const data = await res.json()
      return data.threads || []
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const threads = threadsData || []

  // ── Delete thread mutation ──
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/agent/threads?id=${threadId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete thread")
      return threadId
    },
    onSuccess: (deletedThreadId) => {
      queryClient.invalidateQueries({ queryKey: ["agent-threads"] })
      if (currentThreadId === deletedThreadId) {
        setCurrentThreadId(null)
        setMessages([])
        setError(null)
      }
    },
  })

  // ── Load a thread's full messages ──
  const loadThread = useCallback(
    async (threadId: string) => {
      try {
        const res = await fetch(`/api/agent/threads?id=${threadId}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to load thread")
        const data = await res.json()
        const thread = data.thread as ThreadFull
        if (thread && Array.isArray(thread.messages)) {
          setMessages(
            thread.messages.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          )
          setCurrentThreadId(threadId)
          setError(null)
          // Close mobile sheet when selecting a thread
          setThreadPanelOpen(false)
        }
      } catch {
        setError("Failed to load conversation")
      }
    },
    []
  )

  // ── Auto-load most recent thread on mount ──
  useEffect(() => {
    if (initialLoadDone || !threads.length || !isAuthenticated) return
    setInitialLoadDone(true)
    const mostRecent = threads[0] // already sorted by updatedAt desc
    if (mostRecent) {
      loadThread(mostRecent.threadId)
    }
  }, [threads, isAuthenticated, initialLoadDone, loadThread])

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [isAuthenticated, authLoading, router])

  // Fetch Lottie animation
  useEffect(() => {
    fetch("https://lottie.host/7e64143e-33c7-4846-97b7-77a87d6e131c/dTxJDvuVjF.json")
      .then((r) => r.json())
      .then(setLottieData)
      .catch(() => {})
  }, [])

  // Auto-scroll — use direct scrollTop to avoid smooth-scroll lag during streaming
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight
    }
  }, [messages])

  // Scroll tracking
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      userScrolledUpRef.current = !atBottom
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return
      setError(null)

      const userMsg: ChatMessage = { role: "user", content: text.trim() }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setInput("")
      setIsStreaming(true)
      userScrolledUpRef.current = false

      if (textareaRef.current) textareaRef.current.style.height = "auto"

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: text.trim(),
            threadId: currentThreadId || undefined,
            history: currentThreadId ? undefined : messages.slice(-18),
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ message: "Request failed" }))
          throw new Error(err.message || `Error ${res.status}`)
        }

        // Read threadId from response header
        const responseThreadId = res.headers.get("X-Thread-Id")
        if (responseThreadId && !currentThreadId) {
          setCurrentThreadId(responseThreadId)
        }

        if (!res.body) throw new Error("No response stream")

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ""

        setMessages((prev) => [...prev, { role: "assistant", content: "" }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          assistantContent += chunk

          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantContent,
            }
            return updated
          })
        }

        // Refresh thread list after successful message (new thread may have been created)
        queryClient.invalidateQueries({ queryKey: ["agent-threads"] })
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong")
          setMessages((prev) => {
            if (
              prev.length > 0 &&
              prev[prev.length - 1].role === "assistant" &&
              !prev[prev.length - 1].content
            ) {
              return prev.slice(0, -1)
            }
            return prev
          })
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [messages, isStreaming, currentThreadId, queryClient]
  )

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const startNewChat = useCallback(() => {
    setMessages([])
    setCurrentThreadId(null)
    setInput("")
    setError(null)
    stopStreaming()
    setThreadPanelOpen(false)
  }, [stopStreaming])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(input)
    },
    [input, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage]
  )

  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [])

  if (authLoading || !isAuthenticated) return null

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="h-dvh overflow-hidden">
        <SiteHeader
          title="Finance Agent"
          subtitle="AI-powered financial advisor"
        />
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* DESKTOP THREAD SIDEBAR                                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {threadSidebarVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="hidden md:flex flex-col border-r border-border/40 bg-card/30 overflow-hidden shrink-0"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <IconHistory className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Conversations
                    </span>
                  </div>
                  <button
                    onClick={() => setThreadSidebarVisible(false)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </div>
                <ThreadSidebarContent
                  threads={threads}
                  isLoading={threadsLoading}
                  currentThreadId={currentThreadId}
                  onSelectThread={loadThread}
                  onDeleteThread={(id) => deleteThreadMutation.mutate(id)}
                  onNewChat={startNewChat}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MAIN CHAT AREA                                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {!chatStarted ? (
              /* ═══════════════════════════════════════════════════════ */
              /* LANDING STATE                                          */
              /* ═══════════════════════════════════════════════════════ */
              <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10 md:px-6 relative">
                {/* Thread panel toggle buttons */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  {/* Mobile: Sheet trigger */}
                  <Sheet open={threadPanelOpen} onOpenChange={setThreadPanelOpen}>
                    <SheetTrigger asChild>
                      <button className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <IconHistory className="h-4 w-4" />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
                      <SheetHeader className="px-3 py-2 border-b border-border/40">
                        <SheetTitle className="text-sm">Conversations</SheetTitle>
                      </SheetHeader>
                      <ThreadSidebarContent
                        threads={threads}
                        isLoading={threadsLoading}
                        currentThreadId={currentThreadId}
                        onSelectThread={loadThread}
                        onDeleteThread={(id) => deleteThreadMutation.mutate(id)}
                        onNewChat={startNewChat}
                      />
                    </SheetContent>
                  </Sheet>
                  {/* Desktop: reopen sidebar */}
                  {!threadSidebarVisible && (
                    <button
                      onClick={() => setThreadSidebarVisible(true)}
                      className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Show conversations"
                    >
                      <IconMenu2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <motion.div
                  className="flex flex-col items-center w-full max-w-xl"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {/* Hero animation */}
                  {lottieData ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="h-36 w-36 drop-shadow-lg"
                    >
                      <Lottie
                        animationData={lottieData}
                        loop
                        autoplay
                        className="h-full w-full"
                      />
                    </motion.div>
                  ) : (
                    <HeroOrb />
                  )}

                  {/* Title */}
                  <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
                    Finance Agent
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                    I have access to all your transactions, investments, budgets,
                    and goals. Ask me anything about your finances.
                  </p>

                  {/* Capability pills */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                    {[
                      "Transactions",
                      "Investments",
                      "Budgets",
                      "Goals",
                      "FIRE",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Suggested prompts */}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 w-full">
                    {[
                      "What are my top spending categories this month?",
                      "Am I on track with my savings goals?",
                      "How can I reduce my food spending?",
                      "Give me a monthly financial summary",
                      "What subscriptions should I review?",
                      "How is my investment portfolio performing?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Input card */}
                  <div className="w-full mt-8">
                    <form onSubmit={handleSubmit}>
                      <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value)
                            adjustTextareaHeight()
                          }}
                          onKeyDown={handleKeyDown}
                          placeholder="Ask about your finances..."
                          rows={2}
                          className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-sm outline-none placeholder:text-muted-foreground/50"
                          style={{ minHeight: 80, maxHeight: 160 }}
                        />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground/40">
                            Shift+Enter for new line
                          </span>
                          <button
                            type="submit"
                            disabled={!input.trim()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <IconSend2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Quick actions */}
                  <div className="mt-5 grid grid-cols-2 gap-2 w-full sm:grid-cols-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => sendMessage(action.prompt)}
                        className="group flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/50 px-3 py-2.5 text-left transition-all hover:border-primary/20 hover:bg-card hover:shadow-sm"
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${action.bg} ${action.color} transition-colors`}
                        >
                          <action.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : (
              /* ═══════════════════════════════════════════════════════ */
              /* CHAT STATE                                             */
              /* ═══════════════════════════════════════════════════════ */
              <div className="relative flex flex-1 flex-col overflow-hidden">
                {/* Chat header bar */}
                <div className="flex items-center justify-between border-b border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2 md:px-6">
                  <div className="flex items-center gap-2.5">
                    {/* Mobile: thread panel trigger */}
                    <Sheet open={threadPanelOpen} onOpenChange={setThreadPanelOpen}>
                      <SheetTrigger asChild>
                        <button className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                          <IconHistory className="h-3.5 w-3.5" />
                        </button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
                        <SheetHeader className="px-3 py-2 border-b border-border/40">
                          <SheetTitle className="text-sm">Conversations</SheetTitle>
                        </SheetHeader>
                        <ThreadSidebarContent
                          threads={threads}
                          isLoading={threadsLoading}
                          currentThreadId={currentThreadId}
                          onSelectThread={loadThread}
                          onDeleteThread={(id) => deleteThreadMutation.mutate(id)}
                          onNewChat={startNewChat}
                        />
                      </SheetContent>
                    </Sheet>
                    {/* Desktop: reopen sidebar */}
                    {!threadSidebarVisible && (
                      <button
                        onClick={() => setThreadSidebarVisible(true)}
                        className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Show conversations"
                      >
                        <IconMenu2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="relative">
                      {lottieData ? (
                        <div className="h-8 w-8">
                          <Lottie animationData={lottieData} loop autoplay className="h-full w-full" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2">
                          <IconRobot className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                          isStreaming ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-none">
                        Finance Agent
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isStreaming ? "Thinking..." : "Ready"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/70 bg-muted/40 rounded-md px-2 py-0.5 tabular-nums">
                      <IconMessageCircle className="inline h-3 w-3 mr-0.5 -mt-px" />
                      {messages.length}
                    </span>
                    <button
                      onClick={startNewChat}
                      className="flex h-7 items-center gap-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors px-2"
                      title="New chat"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium hidden sm:inline">New</span>
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4 md:px-6"
                >
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                    >
                      <ChatBubble role={msg.role} content={msg.content} />
                    </motion.div>
                  ))}

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area — floats over chat */}
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-2 pt-6 md:px-6 bg-gradient-to-t from-background from-60% to-transparent pointer-events-none">
                  <form
                    onSubmit={handleSubmit}
                    className="pointer-events-auto mx-auto flex max-w-3xl items-end gap-2"
                  >
                    <div className="flex-1 relative rounded-full border border-border/40 bg-background/80 backdrop-blur-xl shadow-lg ring-1 ring-white/5 transition-all focus-within:border-primary/50 focus-within:shadow-primary/10 focus-within:ring-primary/10">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value)
                          adjustTextareaHeight()
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          isStreaming
                            ? "Generating response..."
                            : "Ask about your finances..."
                        }
                        disabled={isStreaming}
                        rows={1}
                        className="w-full resize-none rounded-full bg-transparent px-5 py-3 text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                        style={{ minHeight: 44, maxHeight: 160 }}
                      />
                    </div>

                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={stopStreaming}
                        className="flex h-[44px] w-[44px] shrink-0 self-end items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-lg transition-all hover:bg-destructive"
                      >
                        <IconPlayerStop className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="flex h-[44px] w-[44px] shrink-0 self-end items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <IconSend2 className="h-4 w-4" />
                      </button>
                    )}
                  </form>
                  <p className="pointer-events-auto text-center text-[11px] text-muted-foreground/40 mt-1.5">
                    Responses are based on your financial data. Always verify
                    important decisions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
