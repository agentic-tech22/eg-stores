"use client";

import Link from "next/link";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

/** A single entry in an {@link ActionMenu}. */
export interface ActionMenuItem {
  /** Stable key for React. */
  key: string;
  /** Row label shown in the menu. */
  label: string;
  /** Optional leading icon (lucide component). */
  icon?: LucideIcon;
  /** Click handler for a button-style item. Ignored when `href` is set. */
  onSelect?: () => void;
  /** When set, the item renders as a navigation link instead of a button. */
  href?: string;
  /** Greys out and disables the item. */
  disabled?: boolean;
  /** Native tooltip, mainly to explain why a `disabled` item can't be used. */
  title?: string;
  /** Styles the item as a dangerous/destructive action (red). */
  destructive?: boolean;
  /** When true, the item is omitted entirely (e.g. lacks permission). */
  hidden?: boolean;
}

interface ActionMenuProps {
  /** Menu entries, in display order. Hidden items are dropped automatically. */
  items: ActionMenuItem[];
  /** Accessible label / tooltip for the trigger button. */
  label?: string;
  /** Which edge of the trigger the menu aligns to. Defaults to `end`. */
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger button. */
  className?: string;
}

const contentClasses = cn(
  "z-50 min-w-[11rem] overflow-hidden rounded-xl border border-admin-border bg-admin-surface p-1 text-admin-text shadow-xl",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

/**
 * A reusable three-dot (kebab) actions menu. Pass a list of {@link ActionMenuItem}s
 * and it renders a `MoreVertical` trigger that opens a themed dropdown. Built on
 * Radix so outside-click, Escape, focus-trapping, portalling, and positioning are
 * handled for free. Use anywhere a table/list row needs a compact action set.
 */
export function ActionMenu({
  items,
  label = "Open actions menu",
  align = "end",
  className,
}: ActionMenuProps) {
  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className={cn(
            "cursor-pointer rounded-lg p-2 text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text data-[state=open]:bg-admin-card data-[state=open]:text-admin-text",
            className,
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={4}
          className={contentClasses}
        >
          {visible.map((item) => {
            const Icon = item.icon;
            const inner = (
              <>
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </>
            );
            const itemClasses = cn(
              "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none select-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
              item.destructive
                ? "text-admin-danger/80 focus:bg-admin-danger/10 focus:text-admin-danger"
                : "text-admin-text-secondary focus:bg-admin-card focus:text-admin-text",
            );

            if (item.href) {
              return (
                <DropdownMenuPrimitive.Item
                  key={item.key}
                  asChild
                  disabled={item.disabled}
                  className={itemClasses}
                >
                  <Link href={item.href} title={item.title}>
                    {inner}
                  </Link>
                </DropdownMenuPrimitive.Item>
              );
            }

            return (
              <DropdownMenuPrimitive.Item
                key={item.key}
                disabled={item.disabled}
                title={item.title}
                onSelect={() => item.onSelect?.()}
                className={itemClasses}
              >
                {inner}
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
