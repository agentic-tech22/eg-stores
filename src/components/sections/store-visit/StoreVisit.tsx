import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

interface StoreVisitProps {
  title: string;
  description: string;
  eyebrow?: string;
  /** Street address from the shop's business profile. Row hidden when null. */
  address?: string | null;
  /** Shop phone from the business profile. Row hidden when null. */
  phone?: string | null;
  whatsappUrl: string;
  className?: string;
  id?: string;
}

function ContactRow({
  iconPath,
  label,
  value,
  href,
}: {
  iconPath: string;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </span>
      <span className="flex flex-col">
        <Typography as="span" variant="label" className="text-text-secondary">
          {label}
        </Typography>
        <Typography
          as="span"
          variant="body"
          className="text-text-primary font-medium"
        >
          {value}
        </Typography>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="focus-visible:ring-ring flex items-center gap-4 rounded-xl transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
      >
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-4">{content}</div>;
}

/**
 * Closing "come see us" block. Address and phone come from the shop's own
 * business profile, so they stay correct without anyone editing this file; each
 * row disappears if that field has not been filled in yet.
 */
export function StoreVisit({
  title,
  description,
  eyebrow,
  address,
  phone,
  whatsappUrl,
  className,
  id,
}: StoreVisitProps) {
  return (
    <section
      id={id}
      className={cn(
        "bg-surface relative overflow-hidden py-16 lg:py-24",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="bg-secondary/10 pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full blur-3xl"
      />

      <Container className="relative z-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            {eyebrow && (
              <Typography variant="label" className="text-secondary">
                {eyebrow}
              </Typography>
            )}
            <Typography variant="h2" className="text-text-primary">
              {title}
            </Typography>
            <Typography variant="bodyLarge" className="text-text-secondary">
              {description}
            </Typography>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button href={whatsappUrl} size="lg">
                Message us on WhatsApp
              </Button>
              <Button href="/products" size="lg" variant="outline">
                Browse the shop
              </Button>
            </div>
          </div>

          <div className="border-border/60 bg-background flex flex-col gap-6 rounded-2xl border p-8">
            {address && (
              <ContactRow
                label="Visit us"
                value={address}
                iconPath="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            )}
            {phone && (
              <ContactRow
                label="Call us"
                value={phone}
                href={`tel:${phone.replace(/\s+/g, "")}`}
                iconPath="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            )}
            <ContactRow
              label="Chat with us"
              value="WhatsApp support"
              href={whatsappUrl}
              iconPath="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
            />
            {!address && !phone && (
              <Typography variant="bodySmall" className="text-text-secondary">
                Add your shop address and phone under Settings → Business and
                they will appear here automatically.
              </Typography>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
