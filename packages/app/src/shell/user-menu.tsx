"use client";

import { PersonAvatar } from "@pantry/ui/components/avatar-stack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pantry/ui/components/dropdown-menu";
import { SidebarMenuButton } from "@pantry/ui/components/sidebar";
import { useTheme, type Theme } from "@pantry/ui/lib/theme";
import { ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useAuthClient } from "../providers";

/** Footer button: who's signed in, theme choice and sign out. */
export function UserMenu({ displayName }: { displayName: string }) {
  const authClient = useAuthClient();
  const session = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const email = session.data?.user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" tooltip={displayName} className="data-popup-open:bg-sidebar-accent" />}
      >
        <PersonAvatar person={{ name: displayName }} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
          {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
        </span>
        <ChevronsUpDownIcon className="ml-auto size-3.5! text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon />
              System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              <SunIcon />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon />
              Dark
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void authClient.signOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
