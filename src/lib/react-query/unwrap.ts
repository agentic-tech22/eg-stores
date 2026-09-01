/** The uniform shape every write server action returns. */
export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Bridges the project's `{ success, error }` server-action convention to the
 * throw-on-failure contract React Query mutations expect. Throws on failure so
 * `useMutation`'s `isError`/`onError` fire; returns the result on success.
 */
export function unwrap<T extends ActionResult>(result: T): T {
  if (!result.success) {
    throw new Error(result.error ?? "Something went wrong. Please try again.");
  }
  return result;
}
