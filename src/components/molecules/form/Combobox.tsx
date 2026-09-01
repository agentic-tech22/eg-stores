"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { controlClasses } from "./field-styles";
import { cn } from "@/utils/cn";

export interface ComboboxOption {
  value: string;
  /** Primary text shown for the option. */
  label: string;
  /** Secondary text (e.g. a SKU) shown muted after the label. */
  hint?: string;
  /** Extra text searched against, beyond `label`/`hint`. */
  keywords?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder inside the search box. */
  searchPlaceholder?: string;
  /** Shown when the query matches no option. */
  emptyMessage?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
  // Association props spread from `Field`.
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Admin-themed searchable select (combo box). A drop-in richer alternative to
 * `Select` for long option lists: the trigger opens a popover with a search box
 * that filters options by label, hint, and keywords. Fully keyboard navigable.
 * Pair with `Field` for labels and error messages.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches found.",
  hasError,
  disabled,
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus the search box and reset state whenever the popover opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  // Keep the active option in view and within bounds as the list changes.
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function commit(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={controlClasses(
          hasError,
          cn(
            "flex items-center justify-between gap-2 pr-10 text-left",
            className,
          ),
        )}
      >
        <span
          className={cn(
            "truncate",
            selected ? "text-admin-text" : "text-admin-text-muted",
          )}
        >
          {selected
            ? selected.hint
              ? `${selected.label} · ${selected.hint}`
              : selected.label
            : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-admin-text-muted transition-transform",
            open && "rotate-180",
            disabled && "opacity-60",
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-admin-border bg-admin-surface shadow-xl">
          <div className="flex items-center gap-2 border-b border-admin-border px-3">
            <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={`${id}-listbox`}
              className="w-full bg-transparent py-2.5 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
            />
          </div>

          <ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2.5 text-sm text-admin-text-muted">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm text-admin-text",
                      isActive && "bg-admin-accent/10",
                      option.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 text-admin-accent",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 truncate">
                      {option.label}
                      {option.hint && (
                        <span className="text-admin-text-muted">
                          {" · "}
                          {option.hint}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
