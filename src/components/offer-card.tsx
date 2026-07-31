import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/marks";
import type { Offer } from "@/lib/offers";

/**
 * Shared between the homepage "fixed-price starting points" band and the
 * /services hub, so the two never drift apart.
 */
export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <Link
      to="/services/$slug"
      params={{ slug: offer.slug }}
      className="card-lift group flex h-full flex-col rounded-2xl border border-hairline bg-white p-5 shadow-soft transition hover:border-ink"
    >
      <p className="text-[16px] font-semibold leading-snug tracking-tight text-ink">
        {offer.title}
      </p>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted-ink">{offer.tagline}</p>
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5">
        <span className="text-[14px] font-semibold text-ink">{offer.priceFrom}</span>
        <span className="text-[12px] text-muted-ink">{offer.timeline}</span>
      </div>
      <span className="btn-icon-nudge mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet group-hover:gap-2.5">
        See what&rsquo;s included
        <IconArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
