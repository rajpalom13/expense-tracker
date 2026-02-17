"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconBrain,
  IconChartPie,
  IconClipboardList,
  IconDashboard,
  IconPigMoney,
  IconWallet,
} from "@tabler/icons-react"

import { NavMain, type NavGroup } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: IconChartPie,
    items: [
      { title: "Transactions", url: "/transactions" },
      { title: "Analytics", url: "/analytics" },
    ],
  },
  {
    label: "Planning",
    icon: IconClipboardList,
    items: [
      { title: "Budget", url: "/budget" },
      { title: "Finance Planner", url: "/planner" },
      { title: "Tax Planner", url: "/tax" },
      { title: "Subscriptions", url: "/subscriptions" },
    ],
  },
  {
    label: "Wealth",
    icon: IconWallet,
    items: [
      { title: "Investments", url: "/investments" },
      { title: "Financial Health", url: "/financial-health" },
      { title: "Goals", url: "/goals" },
    ],
  },
  {
    label: "Intelligence",
    icon: IconBrain,
    items: [
      { title: "AI Insights", url: "/ai-insights" },
      { title: "Finance Agent", url: "/agent" },
      { title: "Learn", url: "/learn" },
    ],
  },
]

const userData = {
  name: "Om Rajpal",
  email: "omrajpal",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard" || pathname === "/"

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

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2">
        {/* Dashboard + collapsible nav groups in a single SidebarGroup */}
        <NavMain dashboardActive={isDashboard} groups={navGroups} />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
