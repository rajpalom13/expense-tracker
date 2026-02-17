"use client"

import * as React from "react"

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { CommandPalette } from "@/components/command-palette"
import { NotificationCenter } from "@/components/notification-center"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface SiteHeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function SiteHeader({
  title = "Dashboard",
  subtitle,
  actions,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b border-border/40 bg-background/60 backdrop-blur-xl backdrop-saturate-150 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 opacity-50"
        />
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <>
                  <span className="hidden sm:inline text-muted-foreground/40 text-sm select-none" aria-hidden="true">&middot;</span>
                  <span className="hidden sm:inline text-xs font-normal text-muted-foreground/70 truncate">
                    {subtitle}
                  </span>
                </>
              )}
            </div>
            {subtitle && (
              <span className="block sm:hidden text-[11px] font-normal text-muted-foreground/60 truncate">
                {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CommandPalette />
            {actions}
            <NotificationCenter />
            <AnimatedThemeToggler />
          </div>
        </div>
      </div>
    </header>
  )
}
