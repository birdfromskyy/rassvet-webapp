// Lightweight in-session cache for static public CMS reads.
//
// Why: the header/footer and public pages re-fetch the same static CMS data
// on every navigation. During active browsing this produced a flood of
// requests (e.g. site-settings ~170×/session) that overwhelmed some clients'
// home networks. Caching the parsed result means repeated reads are served
// from memory instead of the network.
//
// Freshness: every admin mutation calls invalidate(prefix) so edits appear
// immediately. A 5-minute TTL is a safety net in case an invalidation path is
// ever missed — content self-heals without a page reload.
//
// NOTE: intentionally NOT used for employees (teachers) — that list is
// excluded so it always reflects the latest admin changes.

const TTL_MS = 5 * 60 * 1000

const store = new Map() // key -> { promise, expires }

export function cachedGet(key, fetcher) {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.promise

  const promise = Promise.resolve()
    .then(fetcher)
    .catch(err => {
      // Never keep a rejected promise cached.
      const cur = store.get(key)
      if (cur && cur.promise === promise) store.delete(key)
      throw err
    })

  store.set(key, { promise, expires: Date.now() + TTL_MS })
  return promise
}

// Drops the exact key and any param-suffixed variants ("services:xxx").
export function invalidate(prefix) {
  for (const k of Array.from(store.keys())) {
    if (k === prefix || k.startsWith(prefix + ':')) store.delete(k)
  }
}
