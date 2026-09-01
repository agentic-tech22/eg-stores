"use client";

import { useEffect } from "react";
import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { isNetworkError } from "@/lib/errors";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  // Distinguish a lost connection from a genuine app fault so the copy is honest
  // ("check your connection" vs. "unexpected issue").
  const offline = isNetworkError(error);
  const label = offline ? "Connection Lost" : "Something Went Wrong";
  const heading = offline ? "You're offline" : "An error occurred";
  const body = offline
    ? "We couldn't reach the server. Check your internet connection and try again."
    : "We encountered an unexpected issue. Please try again or return to the home page.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Decorative */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/5 blur-3xl" />
      </div>

      <Container size="sm" className="relative z-10 text-center">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-10 w-10 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <Typography variant="label" className="mb-4 text-destructive">
          {label}
        </Typography>

        <Typography variant="h2" className="mb-4 text-text-primary">
          {heading}
        </Typography>

        <Typography
          variant="bodyLarge"
          className="mx-auto mb-4 max-w-md text-text-secondary"
        >
          {body}
        </Typography>

        {error.digest && (
          <Typography
            variant="caption"
            className="mb-8 font-mono text-text-secondary/60"
          >
            Error ID: {error.digest}
          </Typography>
        )}

        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" onClick={reset}>
            Try Again
          </Button>
          <Button variant="outline" href="/">
            Back to Home
          </Button>
        </div>
      </Container>
    </div>
  );
}
