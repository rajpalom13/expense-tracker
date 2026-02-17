"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconBell,
  IconBellCheck,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleCheck,
  IconChecks,
  IconTrash,
} from "@tabler/icons-react"

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNotifications, type Notification } from "@/hooks/use-notifications"

// ─── Helpers ─────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

function groupLabel(iso: string): "Today" | "Yesterday" | "Earlier" {
  const now = new Date()
  const d = new Date(iso)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  if (d >= todayStart) return "Today"
  if (d >= yesterdayStart) return "Yesterday"
  return "Earlier"
}

const severityConfig: Record<
  Notification["severity"],
  { icon: typeof IconAlertCircle; className: string }
> = {
  critical: { icon: IconAlertCircle, className: "text-red-500" },
  warning: { icon: IconAlertTriangle, className: "text-amber-500" },
  info: { icon: IconInfoCircle, className: "text-blue-500" },
  success: { icon: IconCircleCheck, className: "text-emerald-500" },
}

// ─── Notification Item ───────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onNavigate: (url: string) => void
}) {
  const config = severityConfig[notification.severity] || severityConfig.info
  const Icon = config.icon

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-lg border px-3 py-3 transition-colors",
        notification.read
          ? "border-transparent bg-transparent opacity-60"
          : "border-border/50 bg-muted/30"
      )}
    >
      {/* Severity icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("size-[18px]", config.className)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-tight",
              !notification.read && "font-medium text-foreground"
            )}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground/60">
            {relativeTime(notification.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {notification.message}
        </p>

        {/* Action row */}
        <div className="mt-1.5 flex items-center gap-2">
          {notification.actionUrl && (
            <button
              onClick={() => {
                if (!notification.read) onMarkRead(notification._id)
                onNavigate(notification.actionUrl!)
              }}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              View details
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!notification.read && (
              <button
                onClick={() => onMarkRead(notification._id)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Mark as read"
              >
                <IconChecks className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => onDelete(notification._id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Delete"
            >
              <IconTrash className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="absolute top-3 right-3 size-1.5 rounded-full bg-primary" />
      )}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className="rounded-full bg-emerald-500/10 p-4">
        <IconBellCheck className="size-7 text-emerald-500" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">
          You're all caught up!
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Budget alerts, goal milestones, and weekly digests will appear here
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[260px]">
        Notifications are generated automatically based on your financial activity
      </p>
    </div>
  )
}

// ─── Notification Center ─────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
  } = useNotifications()

  function handleNavigate(url: string) {
    setOpen(false)
    router.push(url)
  }

  // Group notifications
  const grouped = React.useMemo(() => {
    const groups: Record<string, Notification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    }
    for (const n of notifications) {
      const label = groupLabel(n.createdAt)
      groups[label].push(n)
    }
    return groups
  }, [notifications])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <IconBell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base">Notifications</SheetTitle>
              <SheetDescription className="text-xs">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "You're all caught up"}
              </SheetDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => markAllRead()}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <IconChecks className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
          {notifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-1">
              {(["Today", "Yesterday", "Earlier"] as const).map((label) => {
                const items = grouped[label]
                if (items.length === 0) return null
                return (
                  <div key={label}>
                    <p className="px-1 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      {label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {items.map((n) => (
                        <NotificationItem
                          key={n._id}
                          notification={n}
                          onMarkRead={(id) => markAsRead([id])}
                          onDelete={deleteNotification}
                          onNavigate={handleNavigate}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
