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

function useIsClient() {
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  return client;
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
  const [visible, setVisible] = useState(false);
  const reduced = usePrefersReducedMotion();
  const client = useIsClient();

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [reduced, threshold]);

  const isHidden = client && !visible && !reduced;

  return (
    <div
      ref={ref}
      className={`reveal ${isHidden ? "reveal-hidden" : "reveal-visible"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
