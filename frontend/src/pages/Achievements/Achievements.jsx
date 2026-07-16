import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import achievementService, { getUploadUrl } from "../../services/achievementService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Achievements.scss";

const parseDescription = (description) => {
  try {
    const parsed = JSON.parse(description || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return description ? [description] : [];
  }
};

function Achievements() {
  const rootRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = "Наши успехи";
  }, []);

  useBrandFont();

  useEffect(() => {
    achievementService
      .getPublic()
      .then(setStories)
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  useReveal(rootRef, [loading, stories.length]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <div className="achievements-page" ref={rootRef}>
      <Header />

      {/* ── Screen 1: hero (dark) ──────────────────────────────── */}
      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Наши успехи</span>
            <h1 className="d2-hero__title">Истории маленьких побед</h1>
            <p className="d2-hero__text">
              Каждая история — это путь ребёнка, семьи и специалистов Центра. Мы
              радуемся даже небольшим шагам, потому что именно из них
              складываются большие возможности.
            </p>
          </div>
        </div>
      </section>

      {/* ── Screen 2: stories (light) ──────────────────────────── */}
      <section className="d2-section d2-section--auto ap-stories">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Истории успеха</span>
            <h2 className="d2-h2">Наши маленькие герои</h2>
          </div>

          {loading ? (
            <p className="d2-empty" data-reveal>Загрузка...</p>
          ) : stories.length === 0 ? (
            <p className="d2-empty" data-reveal>Истории успеха скоро появятся здесь.</p>
          ) : (
          <div className="ap-grid">
            {stories.map((story, index) => {
              const image = getUploadUrl(story.image_url);
              const secondImage = getUploadUrl(story.second_image_url);
              const paragraphs = parseDescription(story.description);

              return (
              <article
                className={`ap-card${index % 2 === 1 ? " ap-card--reverse" : ""}`}
                key={story.id}
                data-reveal
              >
                <div
                  className={`ap-card__media${
                    secondImage ? " ap-card__media--pair" : ""
                  }`}
                >
                  {image && (
                    <button
                      type="button"
                      className="ap-photo"
                      onClick={() => setLightbox(image)}
                      title="Нажмите, чтобы увеличить"
                    >
                      <img src={image} alt={story.child_name} />
                    </button>
                  )}
                  {secondImage && (
                    <button
                      type="button"
                      className="ap-photo"
                      onClick={() => setLightbox(secondImage)}
                      title="Нажмите, чтобы увеличить"
                    >
                      <img src={secondImage} alt="" />
                    </button>
                  )}
                </div>

                <div className="ap-card__content">
                  <span className="ap-card__label">История успеха</span>
                  <h3>{story.child_name}</h3>
                  {paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {story.conclusion && <strong>{story.conclusion}</strong>}
                </div>
              </article>
              );
            })}
          </div>
          )}
        </div>
      </section>

      {lightbox && (
        <div className="ap-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="ap-lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Achievements;
