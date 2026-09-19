import { useEffect } from "react";

/* Lazily loads the Manrope webfont used by the "Rassvet 2.0" design
   (Skills/Design2.md). Only pages that call this hook load the font,
   so the rest of the site is unaffected. Shared id → loaded once. */
const FONT_LINK_ID = "rv-webfont-manrope";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";

export default function useBrandFont() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}
