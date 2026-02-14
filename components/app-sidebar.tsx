"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconChartLine,
  IconClock,
  IconDashboard,
  IconHeartbeat,
  IconReceipt,
  IconTarget,
  IconWallet,
  IconPigMoney,
  IconSparkles,
  IconTrendingUp,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Om Rajpal",
    email: "omrajpal",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: IconReceipt,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartLine,
    },
    {
      title: "Budget",
      url: "/budget",
      icon: IconWallet,
    },
    {
      title: "Investments",
      url: "/investments",
      icon: IconTrendingUp,
    },
    {
      title: "Financial Health",
      url: "/financial-health",
      icon: IconHeartbeat,
    },
    {
      title: "Goals",
      url: "/goals",
      icon: IconTarget,
    },
    {
      title: "AI Insights",
      url: "/ai-insights",
      icon: IconSparkles,
    },
    {
      title: "Cron Jobs",
      url: "/cron",
      icon: IconClock,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <IconPigMoney className="!size-5" />
                <span className="text-base font-semibold">Finance Tracker</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
