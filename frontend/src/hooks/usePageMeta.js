import { useEffect } from "react";

/* Sets the document <title> and the <meta name="description"> content for
   the current page. This is an SPA (no SSR), so the index.html tags remain
   the crawler-facing defaults; this hook keeps the browser tab title and the
   in-page description accurate as the user navigates. */
export default function usePageMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}
