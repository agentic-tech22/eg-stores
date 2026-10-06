"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/utils/cn";

/** Where results live, and the param they are keyed by. */
const RESULTS_PATH = "/products";
const QUERY_PARAM = "q";

interface SearchBoxProps {
  /**
   * The search currently in force, from the URL. When it changes underneath
   * the box — a shared link, the listing's "clear filters" — the box adopts it.
   */
  activeQuery?: string;
  placeholder?: string;
  /**
   * `ink` sits on the dark header, `light` on a white page. Only the surface
   * colours differ; the behaviour is identical.
   */
  tone?: "ink" | "light";
  className?: string;
}

/**
 * The search box itself, with no knowledge of the router's params.
 *
 * Split out from `SearchField` so it can double as that component's Suspense
 * fallback: `useSearchParams` cannot run during a static prerender without a
 * boundary above it, and /cart and /checkout are prerendered. Rendering this
 * as the fallback means the header's search box is present and usable in the
 * prerendered HTML, rather than a hole that fills in on hydration.
 */
function SearchBox({
  activeQuery = "",
  placeholder = "Search phones, earbuds, chargers...",
  tone = "ink",
  className,
}: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(activeQuery);

  // Adopt the URL's search when it changes under us. This is React's
  // "adjust state when a prop changes" pattern rather than an effect: the
  // project's lint forbids setState inside one, and an effect would render the
  // stale value once before correcting it.
  const [lastActive, setLastActive] = useState(activeQuery);
  if (activeQuery !== lastActive) {
    setLastActive(activeQuery);
    setValue(activeQuery);
  }

  /** Apply `query` as the active search, however we got here. */
  function submit(query: string) {
    // Already looking at the results: swap the query string in place.
    //
    // A router push would re-run that route's server component and refetch the
    // whole catalogue just to narrow a list the browser is already holding.
    // Next wires the History API into its router, so the listing's
    // `useSearchParams` still sees this and re-filters immediately.
    if (window.location.pathname === RESULTS_PATH) {
      const params = new URLSearchParams(window.location.search);
      if (query) params.set(QUERY_PARAM, query);
      else params.delete(QUERY_PARAM);
      const rest = params.toString();
      window.history.pushState(null, "", rest ? `?${rest}` : RESULTS_PATH);
      return;
    }

    router.push(
      query
        ? `${RESULTS_PATH}?${QUERY_PARAM}=${encodeURIComponent(query)}`
        : RESULTS_PATH,
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(value.trim());
  }

  function handleClear() {
    setValue("");
    // Clearing the box has to clear the search too. Emptying the text and
    // leaving the grid filtered is the kind of small lie that makes people
    // reload the page.
    if (window.location.pathname === RESULTS_PATH) submit("");
  }

  const ink = tone === "ink";

  return (
    <form
      action={RESULTS_PATH}
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "group flex items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors duration-200",
        ink
          ? "border-shop-ink-border bg-shop-ink-raised focus-within:border-shop-ink-accent/60"
          : "border-border bg-surface focus-within:border-primary/50",
        className,
      )}
    >
      <button
        type="submit"
        aria-label="Search"
        className={cn(
          "shrink-0 cursor-pointer transition-colors",
          ink
            ? "text-shop-ink-muted group-focus-within:text-shop-ink-accent hover:text-shop-ink-text-active"
            : "text-text-muted group-focus-within:text-primary hover:text-text-primary",
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </button>

      {/* `type="search"` for the phone keyboard's "go" key and the input's
          role. WebKit's own clear button that comes with it is suppressed in
          globals.css — this field renders its own, inside the field's padding
          and in the theme's colours, and the two together were showing the
          shopper a pair of crosses. */}
      <input
        type="search"
        name={QUERY_PARAM}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className={cn(
          "w-full min-w-0 border-0 bg-transparent text-sm focus:outline-none",
          ink
            ? "text-shop-ink-text-active placeholder:text-shop-ink-muted"
            : "text-text-primary placeholder:text-text-muted",
        )}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className={cn(
            "shrink-0 cursor-pointer transition-colors",
            ink
              ? "text-shop-ink-muted hover:text-shop-ink-text-active"
              : "text-text-muted hover:text-text-primary",
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </form>
  );
}

type SearchFieldProps = Omit<SearchBoxProps, "activeQuery">;

/**
 * The header's catalogue search.
 *
 * A real `<form>` with a submit rather than a live filter, because the box
 * lives in the header on every page while the results live on /products:
 * typing has to navigate somewhere. A form gets Enter, the phone keyboard's
 * "go" key and a working no-JS fallback for free.
 *
 * This wrapper's only job is to feed the box whatever search the URL is
 * currently expressing, so a shared /products?q=... link arrives with its term
 * in the box instead of a filtered grid above an empty search field.
 */
export function SearchField(props: SearchFieldProps) {
  const searchParams = useSearchParams();
  return (
    <SearchBox {...props} activeQuery={searchParams.get(QUERY_PARAM) ?? ""} />
  );
}

/** The same box, for the Suspense boundary `SearchField` needs. */
export { SearchBox as SearchFieldFallback };
