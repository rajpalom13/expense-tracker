"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Types ───────────────────────────────────────────────────────────

export interface Notification {
  _id: string
  userId: string
  type: string
  title: string
  message: string
  severity: "critical" | "warning" | "info" | "success"
  read: boolean
  actionUrl?: string
  dedupKey?: string
  createdAt: string
}

interface NotificationsResponse {
  success: boolean
  notifications: Notification[]
  message?: string
}

interface MutationResponse {
  success: boolean
  modified?: number
  deleted?: boolean
  message?: string
}

// ─── Fetchers ────────────────────────────────────────────────────────

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { credentials: "include" })
  const data: NotificationsResponse = await res.json()
  if (!data.success) throw new Error(data.message || "Failed to fetch notifications")
  return data
}

async function markRead(body: { ids?: string[]; markAllRead?: boolean }): Promise<MutationResponse> {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data: MutationResponse = await res.json()
  if (!data.success) throw new Error(data.message || "Failed to mark as read")
  return data
}

async function deleteNotification(id: string): Promise<MutationResponse> {
  const res = await fetch(`/api/notifications?id=${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  const data: MutationResponse = await res.json()
  if (!data.success) throw new Error(data.message || "Failed to delete notification")
  return data
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useNotifications() {
  const queryClient = useQueryClient()
  const queryKey = ["notifications"]

  const query = useQuery({
    queryKey,
    queryFn: fetchNotifications,
    refetchInterval: 60 * 1000, // poll every 60 seconds
    staleTime: 30 * 1000,
    retry: 1,
  })

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const notifications = query.data?.notifications ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    markAsRead: (ids: string[]) => markReadMutation.mutate({ ids }),
    markAllRead: () => markReadMutation.mutate({ markAllRead: true }),
    deleteNotification: (id: string) => deleteMutation.mutate(id),
    isMarkingRead: markReadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
