import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";

/* Bridge between the website-led offer and the rest of the studio's work.
   The services grid lists capabilities; this says how they relate: the
   website is the wedge, the rest follows once we're inside the business. */
export function Beyond() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Beyond websites</p>
          <h2 className="mt-3 font-display text-3xl font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-4xl">
            Most clients start with the website.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted-ink">
            Then we build what runs the business behind it. The dashboard that replaces your
            spreadsheets. The automation that routes every lead into your CRM. Booking your
            customers can use without calling you. One studio, one point of contact, no handoffs.
          </p>
          <Link
            to="/services"
            className="btn-icon-nudge mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-violet"
          >
            See everything we build
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
