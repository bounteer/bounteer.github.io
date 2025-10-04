"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Home, FileText, ListChecks, Menu, LogOut, ChevronDown, ChevronRight, ChevronLeft, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { KEYWORDS } from "@/constant";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  isLogout?: boolean;
  children?: NavItem[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { 
    label: "Role Fit Index", 
    href: "/dashboard/role-fit-index", 
    icon: FileText,
    children: [
      { label: "Role Fit Studio", href: "/dashboard/role-fit-studio", icon: BarChart3 },
      { label: "Top Up Credits", href: "/dashboard/role-fit-index/top-up", icon: ListChecks }
    ]
  },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Logout", href: "/logout", icon: LogOut, isLogout: true },
];

function NavLink({ item, isActive, isCollapsed }: { 
  item: NavItem;  
  isActive: (href: string) => boolean;
  isCollapsed?: boolean;
}) {
  const Icon = item.icon;
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Auto-expand if any child is active
  React.useEffect(() => {
    if (item.children) {
      const hasActiveChild = item.children.some(child => child.href && isActive(child.href));
      if (hasActiveChild) {
        setIsExpanded(true);
      }
    }
  }, [item.children, isActive]);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? item.label : undefined}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded border bg-muted">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {!isCollapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </>
          )}
        </button>
        {isExpanded && !isCollapsed && (
          <div className="ml-8 mt-1 space-y-1">
            {item.href && (
              <a
                href={item.href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded border bg-muted">
                  <BarChart3 className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">Overview</span>
              </a>
            )}
            {item.children.map((child, index) => (
              <NavLink
                key={index}
                item={child}
                isActive={isActive}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={item.href!}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        item.isLogout && "text-red-600 hover:bg-red-50 hover:text-red-700",
        isCollapsed && "justify-center"
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded border bg-muted">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </a>
  );
}

export function Sidebar() {
  const img_url = "/favicon-96x96.png";
  const [activePath, setActivePath] = React.useState("/");
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    // Set the active path after hydration to avoid mismatch
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    setActivePath(path);
  }, []);

  const isActive = (href: string) => {
    const cleaned = href.replace(/\/+$/, "") || "/";
    return activePath === cleaned || activePath.startsWith(cleaned + "/");
  };

  return (
    <>
      {/* Mobile: Top bar with hamburger */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-md lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-background">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">Access dashboard sections and account options</SheetDescription>
            <div className="p-3 border-b">
              <a
                href="/"
                className="flex items-center gap-2 text-base font-bold hover:underline"
              >
                <img
                  src={img_url} // favicon.png in /public
                  alt="Bounteer logo"
                  className="h-6 w-6"
                />
                {KEYWORDS.name}
              </a>
            </div>
            <ScrollArea className="h-full px-2 py-3">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href || item.label}
                    item={item}
                    isActive={isActive}
                  />
                ))}
              </nav>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold">Bounteer Dashboard</h1>
      </div>

      {/* Desktop: persistent sidebar */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col shrink-0 border-r bg-background h-[100dvh] sticky top-0 transition-all duration-300",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className={cn(
                "flex items-center gap-2 text-base font-bold hover:underline",
                isCollapsed && "justify-center w-full"
              )}
            >
              <img
                src={img_url} // favicon.png in /public
                alt="Bounteer logo"
                className="h-6 w-6 flex-shrink-0"
              />
              {!isCollapsed && KEYWORDS.name}
            </a>
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isCollapsed && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsCollapsed(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 px-2 py-3">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href || item.label}
                item={item}
                isActive={isActive}
                isCollapsed={isCollapsed}
              />
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}
