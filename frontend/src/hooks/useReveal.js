import { useEffect } from "react";

/* Reveal-on-scroll for the "Rassvet 2.0" design (Skills/Design2.md).
   Adds the `.is-in` class to every [data-reveal] element the first
   time it enters the viewport. Pass values in `deps` that change when
   new [data-reveal] nodes appear after an async load (e.g. CMS data),
   so they get observed too. Respects prefers-reduced-motion and
   degrades gracefully without IntersectionObserver. */
export default function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(root.querySelectorAll("[data-reveal]")).filter(
      (el) => !el.classList.contains("is-in"),
    );

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, ...deps]);
}
