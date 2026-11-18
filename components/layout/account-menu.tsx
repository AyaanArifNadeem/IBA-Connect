"use client";

import Link from "next/link";
import { LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/navigation";
import type { ShellUser } from "./types";

/** Avatar menu, top right on every signed-in page (wireframe P04). */
export function AccountMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Avatar>
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserRound aria-hidden /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings aria-hidden /> Settings
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck aria-hidden /> Admin panel
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {/* Full page navigation: the sign-out route ends the session and redirects */}
        <DropdownMenuItem render={<a href="/sign-out" />}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
