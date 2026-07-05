import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import awardService from "../../services/awardService";
import { getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Awards.scss";

/* Awards page — "Rassvet 2.0" design (Skills/Design2.md).
   Behaviour unchanged: awardService.getPublic(), autoplay carousel,
   prev/next, dots, and click-to-zoom lightbox. */

function Awards() {
  const rootRef = useRef(null);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = "Наши награды";
  }, []);

  useBrandFont();

  useEffect(() => {
    awardService
      .getPublic()
      .then(setAwards)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (awards.length < 2) return undefined;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === awards.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [awards]);

  useReveal(rootRef, [loading, awards.length]);

  const prev = () =>
    setActiveIndex((p) => (p === 0 ? awards.length - 1 : p - 1));
  const next = () =>
    setActiveIndex((p) => (p === awards.length - 1 ? 0 : p + 1));

  return (
    <div className="awards-page" ref={rootRef}>
      <Header />

      {/* ── Screen 1: hero (dark) ──────────────────────────────── */}
      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Наши награды</span>
            <h1 className="d2-hero__title">
              Достижения и благодарности Центра
            </h1>
            <p className="d2-hero__text">
              Здесь представлены дипломы, сертификаты и благодарственные письма,
              отражающие вклад Центра «РАСсвет» в развитие помощи детям и семьям.
            </p>
          </div>
        </div>
      </section>

      {/* ── Screen 2: carousel (light) ─────────────────────────── */}
      <section className="d2-section d2-section--auto aw-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Галерея</span>
            <h2 className="d2-h2">Дипломы и благодарности</h2>
          </div>

          {loading ? (
            <p className="d2-empty" data-reveal>
              Загрузка...
            </p>
          ) : awards.length === 0 ? (
            <p className="d2-empty" data-reveal>
              Награды скоро появятся здесь.
            </p>
          ) : (
            <div data-reveal>
              <div className="aw-carousel">
                {awards.length > 1 && (
                  <button
                    className="aw-carousel__arrow aw-carousel__arrow--left"
                    onClick={prev}
                    type="button"
                    aria-label="Предыдущая награда"
                  >
                    ←
                  </button>
                )}

                <div className="aw-carousel__card">
                  <button
                    type="button"
                    className="aw-carousel__frame"
                    onClick={() => setLightbox(awards[activeIndex])}
                    title="Нажмите для просмотра"
                  >
                    {/* No key/remount here — swapping only the src keeps the
                        <img> node so the browser holds the previous frame
                        until the next decodes (no blank flash). */}
                    <img
                      src={getUploadUrl(awards[activeIndex].image_url)}
                      alt={awards[activeIndex].title}
                    />
                    <span className="aw-carousel__zoom" aria-hidden="true">
                      ⤢
                    </span>
                  </button>
                  {awards[activeIndex].title && (
                    <h3>{awards[activeIndex].title}</h3>
                  )}
                </div>

                {awards.length > 1 && (
                  <button
                    className="aw-carousel__arrow aw-carousel__arrow--right"
                    onClick={next}
                    type="button"
                    aria-label="Следующая награда"
                  >
                    →
                  </button>
                )}
              </div>

              {awards.length > 1 && (
                <div className="aw-carousel__dots">
                  {awards.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={i === activeIndex ? "is-active" : ""}
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Показать награду ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {lightbox && (
        <div className="aw-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="aw-lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
          <img
            src={getUploadUrl(lightbox.image_url)}
            alt={lightbox.title}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.title && (
            <p className="aw-lightbox__caption">{lightbox.title}</p>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Awards;
