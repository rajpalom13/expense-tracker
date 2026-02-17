"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconDashboard,
  IconReceipt,
  IconChartBar,
  IconPigMoney,
  IconCalculator,
  IconFileInvoice,
  IconRepeat,
  IconTrendingUp,
  IconHeartbeat,
  IconTargetArrow,
  IconBrain,
  IconRobot,
  IconSchool,
  IconPlus,
  IconCoinRupee,
  IconMessageChatbot,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

// ─── Page definitions ────────────────────────────────────────────────

interface CommandEntry {
  label: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string[]
}

const pages: CommandEntry[] = [
  {
    label: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
    keywords: ["home", "overview", "summary"],
  },
  {
    label: "Transactions",
    url: "/transactions",
    icon: IconReceipt,
    keywords: ["payments", "expenses", "income", "history"],
  },
  {
    label: "Analytics",
    url: "/analytics",
    icon: IconChartBar,
    keywords: ["charts", "graphs", "reports", "statistics"],
  },
  {
    label: "Budget",
    url: "/budget",
    icon: IconPigMoney,
    keywords: ["spending", "limits", "categories"],
  },
  {
    label: "Finance Planner",
    url: "/planner",
    icon: IconCalculator,
    keywords: ["plan", "projection", "forecast"],
  },
  {
    label: "Tax Planner",
    url: "/tax",
    icon: IconFileInvoice,
    keywords: ["tax", "deductions", "80c", "regime"],
  },
  {
    label: "Subscriptions",
    url: "/subscriptions",
    icon: IconRepeat,
    keywords: ["recurring", "monthly", "services"],
  },
  {
    label: "Investments",
    url: "/investments",
    icon: IconTrendingUp,
    keywords: ["stocks", "mutual funds", "portfolio", "sip"],
  },
  {
    label: "Financial Health",
    url: "/financial-health",
    icon: IconHeartbeat,
    keywords: ["score", "wellness", "assessment"],
  },
  {
    label: "Goals",
    url: "/goals",
    icon: IconTargetArrow,
    keywords: ["savings", "targets", "milestones"],
  },
  {
    label: "AI Insights",
    url: "/ai-insights",
    icon: IconBrain,
    keywords: ["analysis", "recommendations", "ai"],
  },
  {
    label: "Finance Agent",
    url: "/agent",
    icon: IconRobot,
    keywords: ["chat", "assistant", "ask", "ai agent"],
  },
  {
    label: "Learn",
    url: "/learn",
    icon: IconSchool,
    keywords: ["education", "articles", "tips", "knowledge"],
  },
]

const actions: CommandEntry[] = [
  {
    label: "Add transaction",
    url: "/transactions?action=add",
    icon: IconPlus,
    keywords: ["new", "create", "expense", "income"],
  },
  {
    label: "Set budget",
    url: "/budget?action=add",
    icon: IconCoinRupee,
    keywords: ["new", "create", "limit", "category"],
  },
  {
    label: "Ask AI agent",
    url: "/agent",
    icon: IconMessageChatbot,
    keywords: ["chat", "question", "help", "assistant"],
  },
  {
    label: "Sync data",
    url: "/dashboard?sync=true",
    icon: IconRefresh,
    keywords: ["refresh", "update", "import", "sheets"],
  },
]

// ─── Component ───────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [router]
  )

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label="Search"
      >
        <IconSearch className="size-4" />
        <span className="hidden sm:inline text-xs">Search</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70 sm:inline-flex">
          <span className="text-[11px]">Ctrl</span>K
        </kbd>
      </button>

      {/* Command dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={`${page.label} ${page.keywords?.join(" ") ?? ""}`}
                onSelect={() => handleSelect(page.url)}
              >
                <page.icon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <span>{page.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            {actions.map((action) => (
              <CommandItem
                key={action.label}
                value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                onSelect={() => handleSelect(action.url)}
              >
                <action.icon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
