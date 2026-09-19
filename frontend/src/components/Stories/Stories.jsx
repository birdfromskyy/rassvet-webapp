import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import shortsService from "../../services/shortsService";
import "./Stories.scss";

// Convert any supported VK URL to an embed URL
const toVkEmbed = (url) => {
  if (!url) return null;
  const videoMatch = url.match(/video-?(\d+)_(\d+)/);
  if (videoMatch) return `https://vk.com/video_ext.php?oid=-${videoMatch[1]}&id=${videoMatch[2]}&hd=2`;
  const clipMatch = url.match(/clip-?(\d+)_(\d+)/);
  if (clipMatch) return `https://vk.com/video_ext.php?oid=-${clipMatch[1]}&id=${clipMatch[2]}&hd=2`;
  if (url.includes("vk.com") || url.includes("vk.ru") || url.includes("vkvideo")) return url;
  return null;
};

const isVk = (url) => !!(url && (url.includes("vk.com") || url.includes("vk.ru") || url.includes("vkvideo")));

const PER_PAGE = 6;

function Stories() {
  const [stories, setStories] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [page, setPage] = useState(0);
  const [modalLoaded, setModalLoaded] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    shortsService.getPublic().then(setStories).catch(() => setStories([]));
  }, []);

  const activeStory = activeIndex !== null ? stories[activeIndex] : null;

  const closeStory = () => setActiveIndex(null);
  const nextStory = () => setActiveIndex(prev => prev === stories.length - 1 ? 0 : prev + 1);
  const prevStory = () => setActiveIndex(prev => prev === 0 ? stories.length - 1 : prev - 1);

  // Reset loaded state each time modal switches to a different story
  useEffect(() => { setModalLoaded(false); }, [activeIndex]);

  // Autoplay mp4 when modal opens / switches
  useEffect(() => {
    if (!activeStory || isVk(activeStory.video_url) || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }, [activeStory]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeIndex === null) return;
      if (e.key === "Escape") closeStory();
      if (e.key === "ArrowRight") nextStory();
      if (e.key === "ArrowLeft") prevStory();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex]);

  if (stories.length === 0) return null;

  const totalPages = Math.ceil(stories.length / PER_PAGE);
  const visible = stories.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <section className="stories">
      <div className="page-container">
        <div className="stories__row">
          {visible.map((story) => {
            const index = stories.indexOf(story);
            return (
              <button
                className="story-preview"
                key={story.id}
                type="button"
                onClick={() => setActiveIndex(index)}
              >
                <div className="story-preview__frame">
                  {story.cover_url ? (
                    // Facade: cover image available — no iframe needed
                    <>
                      <img
                        className="story-preview__cover"
                        src={story.cover_url}
                        alt={story.title}
                        loading="lazy"
                      />
                      <div className="story-preview__play" aria-hidden="true">
                        <span>▶</span>
                      </div>
                    </>
                  ) : isVk(story.video_url) ? (
                    // No cover — let VK iframe render its own thumbnail
                    <iframe
                      src={toVkEmbed(story.video_url)}
                      className="story-preview__iframe"
                      frameBorder="0"
                      allow="encrypted-media"
                      tabIndex={-1}
                      title={story.title}
                    />
                  ) : story.video_url ? (
                    <>
                      <video
                        className="story-preview__vid"
                        src={story.video_url}
                        muted playsInline
                        tabIndex={-1}
                      />
                      <div className="story-preview__play" aria-hidden="true">
                        <span>▶</span>
                      </div>
                    </>
                  ) : (
                    <div className="story-preview__play" aria-hidden="true">
                      <span>▶</span>
                    </div>
                  )}
                  <div className="story-preview__overlay" aria-hidden="true" />
                </div>
                <span className="story-preview__title">{story.title}</span>
              </button>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="stories__pagination">
            <button
              className="stories__pagination-btn"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Предыдущие"
            >←</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`stories__pagination-dot${i === page ? " is-active" : ""}`}
                onClick={() => setPage(i)}
                aria-label={`Страница ${i + 1}`}
              />
            ))}
            <button
              className="stories__pagination-btn"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              aria-label="Следующие"
            >→</button>
          </div>
        )}
      </div>

      {/* Portal to <body>: keeps the modal out of any ancestor
          stacking context (e.g. a page's fixed header), so it always
          covers the whole viewport. */}
      {activeStory && createPortal(
        <div className="stories-modal" onClick={closeStory}>
          <button className="stories-modal__close" type="button" onClick={closeStory} aria-label="Закрыть">
            ×
          </button>

          <button className="stories-modal__nav stories-modal__nav--left" type="button"
            onClick={e => { e.stopPropagation(); prevStory(); }} aria-label="Предыдущая">
            ←
          </button>

          <div className="stories-modal__card" onClick={e => e.stopPropagation()}>
            <div className="stories-modal__progress">
              {stories.map((s, i) => (
                <span key={s.id} className={i <= activeIndex ? "is-active" : ""} />
              ))}
            </div>

            {isVk(activeStory.video_url) ? (
              <iframe
                key={activeStory.id}
                src={toVkEmbed(activeStory.video_url)}
                className={`stories-modal__iframe${modalLoaded ? " stories-modal__iframe--loaded" : ""}`}
                frameBorder="0"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title={activeStory.title}
                onLoad={() => setModalLoaded(true)}
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  key={activeStory.id}
                  src={activeStory.video_url}
                  controls autoPlay muted playsInline
                />
                {/* Caption only for direct mp4 — VK clips show their own title */}
                <div className="stories-modal__caption">{activeStory.title}</div>
              </>
            )}
          </div>

          <button className="stories-modal__nav stories-modal__nav--right" type="button"
            onClick={e => { e.stopPropagation(); nextStory(); }} aria-label="Следующая">
            →
          </button>
        </div>,
        document.body,
      )}
    </section>
  );
}

export default Stories;
