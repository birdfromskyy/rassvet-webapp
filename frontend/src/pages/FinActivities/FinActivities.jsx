import { useEffect, useRef, useState, useCallback } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { finZoneService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./FinActivities.scss";

import placeholder from "../../assets/photo-placeholder.png";

/* Material & technical resources page — "Rassvet 2.0" design
   (Skills/Design2.md). Same data & behaviour: finZoneService.getAll(),
   intro/section zones, click-to-zoom lightbox, final CTA. */

function FinActivities() {
  const rootRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = "Материально-техническое обеспечение";
  }, []);

  useBrandFont();

  useEffect(() => {
    finZoneService.getAll().then(setZones).catch(() => {});
  }, []);

  useReveal(rootRef, [zones.length]);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  const introZones = zones.filter((z) => !z.title);
  const sectionZones = zones.filter((z) => z.title);

  const renderText = (text, className) =>
    text
      .split(/\n{2,}/)
      .map((para) => para.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .map((para, i) => (
        <p key={i} className={className}>
          {para}
        </p>
      ));

  const PhotoGrid = ({ img1, img2, alt }) => (
    <div className={`fp-photos${img2 ? " fp-photos--two" : ""}`}>
      {img1 && (
        <button
          type="button"
          className="fp-photo"
          onClick={() => setLightbox(img1)}
          title="Нажмите, чтобы увеличить"
        >
          <img
            src={img1}
            alt={alt || ""}
            onError={(e) => {
              e.target.src = placeholder;
            }}
          />
        </button>
      )}
      {img2 && (
        <button
          type="button"
          className="fp-photo"
          onClick={() => setLightbox(img2)}
          title="Нажмите, чтобы увеличить"
        >
          <img
            src={img2}
            alt=""
            onError={(e) => {
              e.target.src = placeholder;
            }}
          />
        </button>
      )}
    </div>
  );

  return (
    <div className="fin-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">О центре</span>
            <h1 className="d2-hero__title">
              Материально-техническое обеспечение
            </h1>
            <p className="d2-hero__text">
              Центр оснащён всем необходимым для развития, обучения и социальной
              адаптации детей — помещения, оборудование и коррекционные среды.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto fp-section">
        <div className="page-container">
          {introZones.length > 0 && (
            <div className="fp-intro" data-reveal>
              {introZones.map((zone) => {
                const img1 = zone.image_url ? getUploadUrl(zone.image_url) : null;
                const img2 = zone.image_url_2
                  ? getUploadUrl(zone.image_url_2)
                  : null;
                return (
                  <div key={zone.id}>
                    {zone.text && renderText(zone.text, "fp-intro-text")}
                    {(img1 || img2) && (
                      <div className="fp-intro-photos">
                        <PhotoGrid img1={img1} img2={img2} />
                      </div>
                    )}
                    {zone.image_caption && (
                      <p className="fp-caption">{zone.image_caption}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {sectionZones.length > 0 && (
            <>
              <div className="d2-head" data-reveal>
                <span className="d2-tag d2-tag--dark">Материальная база</span>
                <h2 className="d2-h2">Помещения и оборудование Центра</h2>
              </div>

              <div className="fp-list">
                {sectionZones.map((zone) => {
                  const img1 = zone.image_url
                    ? getUploadUrl(zone.image_url)
                    : null;
                  const img2 = zone.image_url_2
                    ? getUploadUrl(zone.image_url_2)
                    : null;
                  return (
                    <article className="fp-card" key={zone.id} data-reveal>
                      <h3 className="fp-card__title">{zone.title}</h3>
                      {zone.text && renderText(zone.text, "fp-card__text")}
                      {(img1 || img2) && (
                        <PhotoGrid img1={img1} img2={img2} alt={zone.title} />
                      )}
                      {zone.image_caption && (
                        <p className="fp-caption">{zone.image_caption}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="fp-final" data-reveal>
            <div>
              <span className="fp-final__label">Комфортная среда</span>
              <p className="fp-final__text">
                Центр оснащён всем необходимым для развития, обучения и
                социальной адаптации детей.
              </p>
            </div>
            <a href="/service-algorithm" className="d2-btn d2-btn--ink">
              Алгоритм получения услуг →
            </a>
          </div>
        </div>
      </section>

      {lightbox && (
        <div className="fp-lightbox" onClick={closeLightbox} role="dialog" aria-modal="true">
          <button
            className="fp-lightbox__close"
            onClick={closeLightbox}
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

export default FinActivities;
