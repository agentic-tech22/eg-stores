import { cn } from "@/utils/cn";

export type CheckoutStep = "cart" | "details" | "done";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "cart", label: "Cart" },
  { id: "details", label: "Details" },
  { id: "done", label: "Done" },
];

interface CheckoutStepsProps {
  current: CheckoutStep;
  className?: string;
}

/**
 * Where the shopper is in the three screens between deciding and paying.
 *
 * Sits in the page head on /cart and /checkout. Buying something is the one
 * flow on this site with more than one screen to it, and without this the two
 * pages give no sign they belong to the same sequence — which is the point at
 * which people start wondering how much further there is to go.
 *
 * Not interactive: it reports position, it does not navigate. Jumping forward
 * to a step whose form has not been filled in would only dead-end, and the way
 * back to the cart is already a link in the summary.
 */
export function CheckoutSteps({ current, className }: CheckoutStepsProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px w-5 sm:w-8",
                  done || active ? "bg-primary/50" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "flex items-center gap-2 text-xs font-semibold transition-colors",
                active
                  ? "text-text-primary"
                  : done
                    ? "text-text-secondary"
                    : "text-text-muted",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  active
                    ? "bg-primary text-white"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "border-border text-text-muted border",
                )}
              >
                {done ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
