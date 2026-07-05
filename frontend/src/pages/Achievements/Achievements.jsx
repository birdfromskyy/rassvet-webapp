import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Achievements.scss";

/* Achievements page — "Rassvet 2.0" design (Skills/Design2.md).
   Content is unchanged: the same in-page success stories as before. */

const stories = [
  {
    name: "Стокач Лёна",
    image: "https://placehold.co/700x500",
    text: [
      "Есть у нас один мальчик — Лёня. Ходит в наш Центр уже почти 3 года.",
      "У Лёни ауто трудотерапия. Занятия, на которых дети осваивают обычные бытовые навыки.",
      "Начинал с самого простого: с поддержки взрослого. Сейчас Лёня становится самостоятельнее и увереннее.",
    ],
  },
  {
    name: "Чормонов Арлен",
    image: "https://placehold.co/700x500",
    secondImage: "https://placehold.co/700x500",
    text: [
      "Как маленькому Арлену большой мир открылся.",
      "После занятий сенсорно-моторной интеграцией Арлен начал допускать физический контакт и стал увереннее взаимодействовать с окружающим миром.",
      "Работа продолжается, и впереди ещё много простых и сложных задач.",
    ],
  },
];

function Achievements() {
  const rootRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = "Наши успехи";
  }, []);

  useBrandFont();
  useReveal(rootRef);

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

          <div className="ap-grid">
            {stories.map((story, index) => (
              <article
                className={`ap-card${index % 2 === 1 ? " ap-card--reverse" : ""}`}
                key={story.name}
                data-reveal
              >
                <div
                  className={`ap-card__media${
                    story.secondImage ? " ap-card__media--pair" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="ap-photo"
                    onClick={() => setLightbox(story.image)}
                    title="Нажмите, чтобы увеличить"
                  >
                    <img src={story.image} alt={story.name} />
                  </button>
                  {story.secondImage && (
                    <button
                      type="button"
                      className="ap-photo"
                      onClick={() => setLightbox(story.secondImage)}
                      title="Нажмите, чтобы увеличить"
                    >
                      <img src={story.secondImage} alt="" />
                    </button>
                  )}
                </div>

                <div className="ap-card__content">
                  <span className="ap-card__label">История успеха</span>
                  <h3>{story.name}</h3>
                  {story.text.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  <strong>Маленькими шагами к большим возможностям!</strong>
                </div>
              </article>
            ))}
          </div>
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
