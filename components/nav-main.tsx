"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { type Icon, IconChevronRight, IconDashboard } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

export interface NavGroup {
  label: string
  icon: Icon
  items: {
    title: string
    url: string
    icon?: Icon
    description?: string
  }[]
}

const smoothEase = [0.16, 1, 0.3, 1] as const

function CollapsibleNavGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const hasActiveItem = group.items.some((item) => pathname === item.url)
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    if (hasActiveItem && !open) setOpen(true)
  }, [hasActiveItem]) // eslint-disable-line react-hooks/exhaustive-deps

  const SectionIcon = group.icon

  return (
    <div className="space-y-0.5">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground"
      >
        <SectionIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
        <span className="flex-1 text-left">{group.label}</span>
        <IconChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: smoothEase }}
            className="overflow-hidden ml-0.5"
          >
            {group.items.map((item, idx) => {
              const isActive = pathname === item.url
              const isLast = idx === group.items.length - 1

              return (
                <div key={item.title} className="relative">
                  {/* Tree connector — vertical line */}
                  <div
                    className={cn(
                      "absolute left-[11px] top-0 w-px",
                      isLast ? "h-[14px]" : "h-full",
                      isActive ? "bg-primary/40" : "bg-muted-foreground/20"
                    )}
                  />
                  {/* Tree connector — horizontal branch */}
                  <div
                    className={cn(
                      "absolute left-[11px] top-[14px] h-px w-2",
                      isActive ? "bg-primary/40" : "bg-muted-foreground/20"
                    )}
                  />

                  <Link
                    href={item.url}
                    className={cn(
                      "block rounded-md py-1 pl-6 pr-2.5 text-sm transition-colors duration-150",
                      isActive
                        ? "font-medium text-primary bg-primary/8"
                        : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                    )}
                  >
                    {item.title}
                  </Link>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NavMain({ groups, dashboardActive }: { groups: NavGroup[]; dashboardActive?: boolean }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="space-y-1">
        {/* Dashboard - standalone top item */}
        <Link
          href="/dashboard"
          className={cn(
            "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150",
            dashboardActive
              ? "text-primary bg-primary/8"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <IconDashboard
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              dashboardActive
                ? "text-primary"
                : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60"
            )}
          />
          <span>Dashboard</span>
        </Link>

        {groups.map((group) => (
          <CollapsibleNavGroup key={group.label} group={group} />
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
