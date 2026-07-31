import { useEffect, useRef, useState } from "react";

const DEFAULT_THRESHOLD = 0.12;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useIsInViewportOnce(
  ref: React.RefObject<HTMLElement | null>,
  { threshold, rootMargin }: { threshold: number; rootMargin: string }
) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Content is rendered visible by default. If the element is already
    // in the viewport on hydration, we keep it visible (no flash). If it is
    // below the fold, we hide it so the reveal animation can play on scroll.
    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (inViewport) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, rootMargin]);

  return revealed;
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  threshold = DEFAULT_THRESHOLD,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const revealed = useIsInViewportOnce(ref, {
    threshold,
    rootMargin: "0px 0px -40px 0px",
  });

  const visible = reduced || revealed;

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : "reveal-hidden"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
