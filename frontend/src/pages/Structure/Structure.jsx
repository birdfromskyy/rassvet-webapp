import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { siteSettingService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Structure.scss";

import structureImg from "../../assets/structure.png";

/* Structure page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data: siteSettingService.getByKey("structure_photo_url"),
   falling back to the bundled diagram. Click the diagram to zoom. */

function Structure() {
  const rootRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(structureImg);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    document.title = "Структура организации";
  }, []);

  useBrandFont();

  useEffect(() => {
    siteSettingService
      .getByKey("structure_photo_url")
      .then(({ value }) => {
        if (value) setImgSrc(getUploadUrl(value));
      })
      .catch(() => {});
  }, []);

  useReveal(rootRef);

  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <div className="structure-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">О центре</span>
            <h1 className="d2-hero__title">Структура организации</h1>
            <p className="d2-hero__text">
              Схема управления и подразделений Центра «РАСсвет». Нажмите на
              изображение, чтобы рассмотреть его подробнее.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto sp-section">
        <div className="page-container">
          <button
            type="button"
            className="sp-frame"
            onClick={() => setZoomed(true)}
            title="Нажмите, чтобы увеличить"
            data-reveal
          >
            <img
              src={imgSrc}
              alt="Структура организации Центра РАСсвет"
              onError={(e) => {
                e.target.src = structureImg;
              }}
            />
          </button>
        </div>
      </section>

      {zoomed && (
        <div className="sp-lightbox" onClick={() => setZoomed(false)}>
          <button
            className="sp-lightbox__close"
            onClick={() => setZoomed(false)}
            aria-label="Закрыть"
          >
            ×
          </button>
          <img
            src={imgSrc}
            alt="Структура организации Центра РАСсвет"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Structure;
