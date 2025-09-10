"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  FileText,
  ListChecks,
  Menu, // ✅ add hamburger icon
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { KEYWORDS } from "@/constant";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  isLogout?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Role Fit Index", href: "/dashboard/role-fit-index", icon: FileText },
  { label: "Top Up Credits", href: "/dashboard/role-fit-index/top-up", icon: ListChecks },
  { label: "Logout", href: "/logout", icon: LogOut, isLogout: true },
];

function NavLink({ item, active }: { item: NavItem; active?: boolean }) {
  const Icon = item.icon;
  
  const baseClasses = "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";
  const normalClasses = active
    ? "bg-accent text-accent-foreground"
    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
  const logoutClasses = "text-red-600 hover:bg-red-50 hover:text-red-700";
  
  const className = cn(
    baseClasses,
    item.isLogout ? logoutClasses : normalClasses
  );

  return (
    <a
      href={item.href}
      className={className}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{item.label}</span>
    </a>
  );
}

export function Sidebar() {
  const [open, setOpen] = React.useState(false);

  // Determine active path (works without react-router)
  const activePath =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "") || "/"
      : "/";

  const isActive = (href: string) => {
    const cleaned = href.replace(/\/+$/, "") || "/";
    return activePath === cleaned || activePath.startsWith(cleaned + "/");
  };

  return (
    <div className="flex">
      {/* Mobile hamburger trigger */}
      <div className="lg:hidden p-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              {/* ✅ icon-only button */}
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="p-4 border-b">
              <div className="text-sm text-muted-foreground">Welcome</div>
              <div className="font-semibold">{KEYWORDS.name}</div>
            </div>
            <ScrollArea className="h-full px-2 py-4">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                  />
                ))}
              </nav>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 border-r bg-muted/30 h-[100dvh] sticky top-0">
        <div className="px-5 pt-6 pb-4 border-b">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Welcome
          </div>
          <div className="mt-1 text-base font-semibold">{KEYWORDS.name}</div>
        </div>
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </div>
  );
}
