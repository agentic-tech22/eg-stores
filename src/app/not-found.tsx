import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 h-72 w-72 rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Container size="sm" className="relative z-10 text-center">
        {/* Large 404 */}
        <div className="mb-8">
          <Typography
            variant="display"
            className="text-[8rem] leading-none font-extralight tracking-tighter text-primary/10 sm:text-[12rem]"
          >
            404
          </Typography>
        </div>

        {/* Message */}
        <Typography variant="label" className="mb-4 text-secondary">
          Page Not Found
        </Typography>

        <Typography variant="h2" className="mb-4 text-text-primary">
          This page doesn&apos;t exist
        </Typography>

        <Typography
          variant="bodyLarge"
          className="mx-auto mb-10 max-w-md text-text-secondary"
        >
          The page you&apos;re looking for may have been moved, deleted, or
          never existed in the first place.
        </Typography>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" href="/">
            Back to Home
          </Button>
          <Button variant="outline" href="/dashboard">
            Dashboard
          </Button>
        </div>
      </Container>
    </div>
  );
}
