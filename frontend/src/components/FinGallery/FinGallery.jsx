import { useState, useEffect, useCallback } from "react";
import "./FinGallery.scss";
import placeholder from "../../assets/photo-placeholder.png";
import { finZoneService, getUploadUrl } from "../../services/cmsService";

function FinGallery() {
  const [zones, setZones] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    finZoneService
      .getAll()
      .then(setZones)
      .catch(() => {});
  }, []);

  const openLightbox = useCallback((src) => setLightbox(src), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") closeLightbox(); };
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
        <p key={i} className={className}>{para}</p>
      ));

  const PhotoGrid = ({ img1, img2, alt }) => (
    <div className={`fin-section__photos${img2 ? " fin-section__photos--two" : ""}`}>
      {img1 && (
        <img
          src={img1}
          alt={alt || ""}
          className="fin-section__photo"
          onClick={() => openLightbox(img1)}
          onError={(e) => { e.target.src = placeholder; }}
        />
      )}
      {img2 && (
        <img
          src={img2}
          alt=""
          className="fin-section__photo"
          onClick={() => openLightbox(img2)}
          onError={(e) => { e.target.src = placeholder; }}
        />
      )}
    </div>
  );

  return (
    <>
      {lightbox && (
        <div className="fin-lightbox" onClick={closeLightbox} role="dialog" aria-modal="true">
          <button className="fin-lightbox__close" onClick={closeLightbox} aria-label="Закрыть">✕</button>
          <img
            src={lightbox}
            alt=""
            className="fin-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <section className="fin-gallery">
        <div className="container">
        {introZones.length > 0 && (
          <div className="fin-gallery__intro">
            {introZones.map((zone) => {
              const img1 = zone.image_url ? getUploadUrl(zone.image_url) : null;
              const img2 = zone.image_url_2 ? getUploadUrl(zone.image_url_2) : null;
              return (
                <div key={zone.id}>
                  {zone.text && renderText(zone.text, "fin-gallery__intro-text")}
                  {(img1 || img2) && (
                    <div style={{ marginTop: 24 }}>
                      <PhotoGrid img1={img1} img2={img2} />
                    </div>
                  )}
                  {zone.image_caption && (
                    <p className="fin-section__caption">{zone.image_caption}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sectionZones.length > 0 && (
          <>
            <div className="fin-gallery__head">
              <span className="section-badge">Материальная база</span>
              <h2>Помещения и оборудование Центра</h2>
            </div>

            <div className="fin-gallery__list">
              {sectionZones.map((zone) => {
                const img1 = zone.image_url ? getUploadUrl(zone.image_url) : null;
                const img2 = zone.image_url_2 ? getUploadUrl(zone.image_url_2) : null;
                return (
                  <article className="fin-section" key={zone.id}>
                    <h3 className="fin-section__title">{zone.title}</h3>

                    {zone.text && renderText(zone.text, "fin-section__text")}

                    {(img1 || img2) && <PhotoGrid img1={img1} img2={img2} alt={zone.title} />}

                    {zone.image_caption && (
                      <p className="fin-section__caption">{zone.image_caption}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}


        <div className="fin-gallery__final">
          <div>
            <span>Комфортная среда</span>
            <h2>
              Центр оснащён всем необходимым для развития, обучения и социальной
              адаптации детей.
            </h2>
          </div>

          <a href="/service-algorithm" className="fin-gallery__button">
            Алгоритм получения услуг →
          </a>
        </div>
      </div>
    </section>
    </>
  );
}

export default FinGallery;
