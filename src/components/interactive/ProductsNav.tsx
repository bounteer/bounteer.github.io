import * as React from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

const productsForRecruiters = [
  {
    title: "Orbit Signal",
    href: "/orbit-signal",
    description: "AI-powered market intelligence for recruiting agencies"
  },
  {
    title: "Orbit Call",
    href: "/orbit-call",
    description: "Automated outreach and engagement tracking"
  },
  {
    title: "Orbit Pulse",
    href: "/orbit-pulse",
    description: "Real-time insights and analytics dashboard"
  },
];

const productsForCandidates = [
  {
    title: "Role Fit Index",
    href: "/role-fit-index",
    description: "Measure your match score with job opportunities"
  },
  {
    title: "Role Fit Studio",
    href: "/role-fit-studio",
    description: "Optimize your profile and applications"
  },
];

export default function ProductsNav() {
  return (
    <NavigationMenu>
      <NavigationMenuList className="gap-6">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent hover:bg-transparent text-sm text-black/70 hover:text-black transition-colors">
            For Recruiters
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4">
              {productsForRecruiters.map((product) => (
                <ListItem
                  key={product.title}
                  title={product.title}
                  href={product.href}
                >
                  {product.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent hover:bg-transparent text-sm text-black/70 hover:text-black transition-colors">
            For Candidates
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4">
              {productsForCandidates.map((product) => (
                <ListItem
                  key={product.title}
                  title={product.title}
                  href={product.href}
                >
                  {product.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { title: string }
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-black/5 hover:text-black focus:bg-black/5 focus:text-black",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-black/60">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
