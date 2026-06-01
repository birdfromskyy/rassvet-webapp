import { useEffect, useRef, useState } from "react";
import shortsService from "../../services/shortsService";
import "./Stories.scss";

// Convert any supported VK URL to an embed URL
const toVkEmbed = (url, autoplay = false) => {
  if (!url) return null;
  const auto = autoplay ? "&autoplay=1" : "";
  const videoMatch = url.match(/video-?(\d+)_(\d+)/);
  if (videoMatch) return `https://vk.com/video_ext.php?oid=-${videoMatch[1]}&id=${videoMatch[2]}&hd=2${auto}`;
  const clipMatch = url.match(/clip-?(\d+)_(\d+)/);
  if (clipMatch) return `https://vk.com/video_ext.php?oid=-${clipMatch[1]}&id=${clipMatch[2]}&hd=2${auto}`;
  if (url.includes("vk.com") || url.includes("vkvideo")) return url;
  return null;
};

const isVk = (url) => !!(url && (url.includes("vk.com") || url.includes("vkvideo")));

const PER_PAGE = 6;

function Stories() {
  const [stories, setStories] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [page, setPage] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    shortsService.getPublic().then(setStories).catch(() => setStories([]));
  }, []);

  const activeStory = activeIndex !== null ? stories[activeIndex] : null;

  const closeStory = () => setActiveIndex(null);
  const nextStory = () => setActiveIndex(prev => prev === stories.length - 1 ? 0 : prev + 1);
  const prevStory = () => setActiveIndex(prev => prev === 0 ? stories.length - 1 : prev - 1);

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
      <div className="container">
        <div className="stories__row">
          {visible.map((story) => {
            const index = stories.indexOf(story);
            const embedUrl = toVkEmbed(story.video_url);
            return (
              <button
                className="story-preview"
                key={story.id}
                type="button"
                onClick={() => setActiveIndex(index)}
              >
                <div className="story-preview__frame">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      className="story-preview__iframe"
                      frameBorder="0"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      tabIndex={-1}
                      title={story.title}
                    />
                  ) : story.video_url ? (
                    <video
                      className="story-preview__vid"
                      src={story.video_url}
                      muted loop autoPlay playsInline
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="story-preview__empty">▶</div>
                  )}
                  {/* Transparent overlay so clicks always reach the button */}
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

      {activeStory && (
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
                src={toVkEmbed(activeStory.video_url, true)}
                className="stories-modal__iframe"
                frameBorder="0"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title={activeStory.title}
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
        </div>
      )}
    </section>
  );
}

export default Stories;
