import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import achievementService, { getUploadUrl } from "../../services/achievementService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Achievements.scss";

const excerpt = (value, maxLength = 190) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
};

function Achievements() {
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="achievements-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Наши успехи</span>
            <h1 className="d2-hero__title">Истории маленьких побед</h1>
            <p className="d2-hero__text">
              Каждая история — это путь ребёнка, семьи и специалистов Центра.
              Именно из небольших шагов складываются большие возможности.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto ap-catalog">
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
            <div className="ap-catalog__grid">
              {stories.map((story) => {
                const image = getUploadUrl(story.preview_image_url);
                return (
                  <article className="ap-story-card" key={story.id} data-reveal>
                    <button
                      type="button"
                      className="ap-story-card__open"
                      onClick={() => navigate(`/achievements/${story.id}`)}
                      aria-label={`Открыть историю «${story.child_name}»`}
                    >
                      <div className="ap-story-card__media">
                        {image ? <img src={image} alt={story.child_name} /> : <span>История успеха</span>}
                      </div>
                      <div className="ap-story-card__content">
                        <span className="ap-story-card__label">История успеха</span>
                        <h3>{story.child_name}</h3>
                        {story.preview_text && <p>{excerpt(story.preview_text)}</p>}
                        <strong>Читать историю <span aria-hidden="true">→</span></strong>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Achievements;
