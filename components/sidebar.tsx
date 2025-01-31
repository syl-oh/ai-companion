"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { useProModal } from "@/hooks/use-pro-modal";
import { cn } from "@/src/lib/utils";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  Atom,
  MessageSquare,
  Plus,
  Settings,
  Store,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

interface SidebarProps {
  isPro: boolean;
  hasChat: boolean;
}

interface Route {
  icon: any;
  href: string;
  pathname?: string;
  searchparams?: Record<string, string>;
  label: string;
  pro: boolean;
  regex: RegExp;
}

const isActive = (
  route: Route,
  pathname: string,
  searchparams: ReadonlyURLSearchParams
) => {
  let pathActive;
  if (route.regex) {
    pathActive = route.regex.test(pathname);
  } else if (route.pathname) {
    pathActive = pathname === route.pathname;
  } else {
    pathname === route.href;
  }

  if (route.searchparams) {
    const params = Object.fromEntries(searchparams.entries());
    const requiredParams = Object.entries(route.searchparams);
    if (requiredParams.length === 0) {
      return pathActive;
    }
    const searchActive = requiredParams.every(([key, value]) =>
      value === null ? !params[key] : params[key] === value
    );
    return pathActive && searchActive;
  }
  return pathActive;
};

export const Sidebar = ({ isPro, hasChat }: SidebarProps) => {
  const proModal = useProModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchparams = useSearchParams();

  const onNavigate = (url: string, pro: boolean) => {
    if (pro && !isPro) {
      return proModal.onOpen();
    }

    return router.push(url);
  };

  const routes = [
    {
      icon: Store,
      href: "/",
      pathname: "/",
      searchparams: { scope: null },
      label: "Browse",
      pro: false,
    },
    {
      icon: Plus,
      href: "/ai/new/edit",
      regex: /\/ai\/(.*)\/edit/,
      label: "Create",
      pro: false,
    },
    {
      icon: Atom,
      href: "/?scope=OWNED",
      pathname: "/",
      searchparams: { scope: "OWNED" },
      label: "Your AIs",
      pro: false,
    },
    {
      icon: UserPlus,
      href: "/?scope=SHARED",
      pathname: "/",
      searchparams: { scope: "SHARED" },
      label: "Shared",
      pro: false,
    },
    {
      icon: Wrench,
      href: "/dashboard",
      label: "Tools",
      pro: true,
    },
    {
      icon: Settings,
      href: "/settings",
      label: "Settings",
      pro: true,
    },
  ] as Route[];
  return (
    <div className="p-3 flex-1 flex justify-between flex-col h-full">
      <div className="space-y-2 flex flex-col items-center">
        <div className="h-16">
          <OrganizationSwitcher
            hidePersonal={true}
            appearance={{
              baseTheme: dark,
            }}
          />
        </div>
        <div
          onClick={() => onNavigate(`/chat/`, false)}
          className={cn(
            "text-muted-foreground text-xs group py-3 px-8 flex w-full justify-center font-medium rounded-lg transition",
            pathname.startsWith("/chat/")
              ? "bg-accent text-primary cursor-pointer hover:text-primary hover:bg-primary/10"
              : hasChat
              ? "cursor-pointer hover:text-primary hover:bg-primary/10"
              : "opacity-25"
          )}
        >
          <div className="flex flex-col items-center flex-1">
            <MessageSquare className="h-5 w-5 mb-1" />
            Chat
          </div>
        </div>
        {routes.map((route) => (
          <div
            onClick={() => onNavigate(route.href, route.pro)}
            key={route.href}
            className={cn(
              "text-muted-foreground text-xs group py-3 px-8 flex w-full justify-center font-medium cursor-pointer hover:text-primary hover:bg-primary/10 rounded-lg transition",
              isActive(route, pathname, searchparams) &&
                "bg-accent text-primary",
              route.pro && "hidden"
            )}
          >
            <div className="flex flex-col items-center flex-1">
              <route.icon className="h-5 w-5 mb-1" />
              <span className="w-12 text-center">{route.label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 flex flex-col items-center py-3 px-8">
        <ModeToggle />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            baseTheme: dark,
          }}
        />
      </div>
    </div>
  );
};
