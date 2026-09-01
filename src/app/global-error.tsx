"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafaf8",
          color: "#1a1a2e",
          fontFamily:
            "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: "0 24px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "rgba(197, 48, 48, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 32px",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c53030"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#c53030",
              marginBottom: 16,
            }}
          >
            Critical Error
          </p>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 300,
              lineHeight: 1.2,
              margin: "0 0 16px",
            }}
          >
            Something went very wrong
          </h1>

          <p
            style={{
              fontSize: 15,
              color: "#6b6b7b",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            The application encountered a critical error and could not
            recover. Please try refreshing the page.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: 11,
                color: "#9ca3af",
                fontFamily: "monospace",
                marginBottom: 32,
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                borderRadius: 6,
                backgroundColor: "#c9a96e",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 500,
                border: "1px solid #e4e3dd",
                borderRadius: 6,
                backgroundColor: "transparent",
                color: "#1a1a2e",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
