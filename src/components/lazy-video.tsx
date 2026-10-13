import { useEffect, useRef, type ComponentProps } from "react";
import { useIsInViewportOnce } from "@/components/reveal";

/**
 * Muted autoplay loop that is not fetched until it is near the viewport.
 *
 * `preload="none"` alone does not stop an `autoplay` video from downloading,
 * so the three home-page loops (3.3 MB) all competed with the hero on first
 * load. The poster paints at SSR; the file is attached 200px before the box
 * scrolls into view, which also covers the hero reel on phones where it sits
 * below the headline.
 */
export function LazyVideo({
  src,
  ...props
}: Omit<ComponentProps<"video">, "src" | "children"> & { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const near = useIsInViewportOnce(ref, { threshold: 0, rootMargin: "200px 0px" });

  useEffect(() => {
    if (near) ref.current?.play().catch(() => {});
  }, [near]);

  return (
    <video ref={ref} autoPlay muted loop playsInline preload="none" {...props}>
      {near && <source src={src} type="video/mp4" />}
    </video>
  );
}
