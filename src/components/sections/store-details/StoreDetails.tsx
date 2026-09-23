import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import {
  mapDirectionsUrl,
  mapEmbedUrl,
  type OpeningHours,
} from "@/config/store";
import { cn } from "@/utils/cn";

interface StoreDetailsProps {
  /** From the shop's business profile. The map hides itself when null. */
  address?: string | null;
  phone?: string | null;
  whatsappUrl: string;
  hours: OpeningHours[];
  /** Landmark directions. Hidden when null. */
  directions?: string | null;
  className?: string;
  id?: string;
}

const PIN_ICON =
  "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z";
const PHONE_ICON =
  "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z";
const CLOCK_ICON = "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z";

function DetailCard({
  iconPath,
  label,
  children,
}: {
  iconPath: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-background flex flex-col gap-4 rounded-2xl border p-7">
      <span className="bg-primary/10 text-primary inline-flex h-11 w-11 items-center justify-center rounded-xl">
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
      <Typography as="h3" variant="h4" className="text-text-primary">
        {label}
      </Typography>
      {children}
    </div>
  );
}

/**
 * Address, opening hours, phone and a map — the four things someone checks
 * before walking to a shop.
 *
 * Every block degrades on its own: no address means no map and no directions
 * button, no phone means no call row. A shop that has not filled in its business
 * profile gets a shorter page rather than "undefined" under a map pin.
 */
export function StoreDetails({
  address,
  phone,
  whatsappUrl,
  hours,
  directions,
  className,
  id,
}: StoreDetailsProps) {
  const telHref = phone ? `tel:${phone.replace(/\s+/g, "")}` : null;

  return (
    <section id={id} className={cn("py-16 lg:py-24", className)}>
      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DetailCard iconPath={PIN_ICON} label="Where to find us">
            {address ? (
              <Typography variant="body" className="text-text-secondary">
                {address}
              </Typography>
            ) : (
              <Typography variant="bodySmall" className="text-text-secondary">
                Add your shop address under Settings → Business and it will
                appear here automatically.
              </Typography>
            )}
            {address && (
              <Button
                href={mapDirectionsUrl(address)}
                variant="outline"
                size="sm"
                className="self-start"
              >
                Get directions
              </Button>
            )}
          </DetailCard>

          <DetailCard iconPath={CLOCK_ICON} label="Opening hours">
            <dl className="flex flex-col gap-2">
              {hours.map((row) => (
                <div
                  key={row.days}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt>
                    <Typography
                      as="span"
                      variant="bodySmall"
                      className="text-text-secondary"
                    >
                      {row.days}
                    </Typography>
                  </dt>
                  <dd>
                    <Typography
                      as="span"
                      variant="bodySmall"
                      className={cn(
                        "font-medium",
                        row.closed
                          ? "text-text-secondary/60"
                          : "text-text-primary",
                      )}
                    >
                      {row.hours}
                    </Typography>
                  </dd>
                </div>
              ))}
            </dl>
          </DetailCard>

          <DetailCard iconPath={PHONE_ICON} label="Talk to us">
            <div className="flex flex-col gap-3">
              {telHref && phone && (
                <a
                  href={telHref}
                  className="focus-visible:ring-ring rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Typography
                    as="span"
                    variant="body"
                    className="text-text-primary font-medium"
                  >
                    {phone}
                  </Typography>
                </a>
              )}
              <Typography variant="bodySmall" className="text-text-secondary">
                Call ahead to check a model is in stock, or send us a message and
                we will hold it for you.
              </Typography>
              <Button
                href={whatsappUrl}
                size="sm"
                variant="outline"
                className="self-start"
              >
                Message on WhatsApp
              </Button>
            </div>
          </DetailCard>
        </div>

        {address && (
          <div className="mt-10 flex flex-col gap-4">
            <div className="border-border/60 overflow-hidden rounded-2xl border">
              {/* Keyless embed, so no billable Maps key ships to the browser.
                  Lazy-loaded: the map sits below the fold and is the heaviest
                  thing on the page. */}
              <iframe
                src={mapEmbedUrl(address)}
                title="Map showing the shop location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="h-[320px] w-full border-0 lg:h-[420px]"
              />
            </div>
            {directions && (
              <Typography variant="bodySmall" className="text-text-secondary">
                {directions}
              </Typography>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
