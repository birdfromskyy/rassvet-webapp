import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { cmsFileGroupService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import ratingPoster from "../../assets/rating-poster.jpg";
import "./Rating.scss";

/* Rating page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data as before: cmsFileService.getBySection("rating"). */

function Rating() {
  const rootRef = useRef(null);
  const [content, setContent] = useState({ groups: [], ungrouped: [] });
  const [isPosterOpen, setIsPosterOpen] = useState(false);

  useEffect(() => {
    document.title = "Независимая оценка качества";
  }, []);

  useBrandFont();

  useEffect(() => {
    cmsFileGroupService.getPublicBySection("rating").then(setContent).catch(() => {});
  }, []);

  useReveal(rootRef, [content.groups.length, content.ungrouped.length]);

  useEffect(() => {
    if (!isPosterOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsPosterOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPosterOpen]);

  const renderFiles = (files) => (
    <div className="d2-files">
      {files.map((file) => (
        <a
          href={file.file_url ? getUploadUrl(file.file_url) : "#"}
          className="d2-file"
          key={file.id}
          target="_blank"
          rel="noreferrer"
          data-reveal
        >
          <span className="d2-file__icon" aria-hidden="true">PDF</span>
          <h3 className="d2-file__title">{file.title}</h3>
          <span className="d2-file__foot"><span className="d2-file__open">Открыть документ</span><span className="d2-file__arrow" aria-hidden="true">↓</span></span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="rating-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Документы</span>
            <h1 className="d2-hero__title">Независимая оценка качества</h1>
            <p className="d2-hero__text">
              В разделе представлены документы по независимой оценке качества
              условий оказания социальных услуг Центра.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto rating-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Файлы</span>
            <h2 className="d2-h2">Документы по оценке качества</h2>
          </div>

          {content.groups.length || content.ungrouped.length ? (
            <div className="rating-section__groups">
              {content.groups.map((group) => group.files?.length > 0 && (
                <section className="rating-section__group" key={group.id} data-reveal>
                  <h3>{group.title}</h3>
                  {renderFiles(group.files)}
                </section>
              ))}
              {content.ungrouped.length > 0 && (
                <section className="rating-section__group" data-reveal>
                  {content.groups.length > 0 && <h3>Без раздела</h3>}
                  {renderFiles(content.ungrouped)}
                </section>
              )}
            </div>
          ) : (
            <p className="d2-empty" data-reveal>
              Документы скоро появятся здесь.
            </p>
          )}
        </div>
      </section>

      <section className="d2-section d2-section--auto rating-feedback">
        <div className="page-container">
          <div className="rating-feedback__card" data-reveal>
            <div className="rating-feedback__content">
              <span className="d2-tag d2-tag--dark">Обратная связь</span>
              <h2 className="d2-h2">Оцените нашу работу</h2>
              <p>
                Ваше мнение помогает Центру становиться лучше. Наведите камеру
                телефона на QR-код на плакате и пройдите короткий опрос.
              </p>
            </div>
            <button
              type="button"
              className="rating-feedback__poster"
              onClick={() => setIsPosterOpen(true)}
              aria-label="Увеличить плакат для оценки работы Центра"
              title="Нажмите, чтобы увеличить"
            >
              <img src={ratingPoster} alt="Плакат с QR-кодом для независимой оценки качества работы Центра «РАСсвет»" />
            </button>
          </div>
        </div>
      </section>

      {isPosterOpen && (
        <div className="rating-poster-lightbox" onClick={() => setIsPosterOpen(false)} role="dialog" aria-modal="true" aria-label="Плакат для оценки работы Центра">
          <button type="button" className="rating-poster-lightbox__close" onClick={() => setIsPosterOpen(false)} aria-label="Закрыть">×</button>
          <img src={ratingPoster} alt="Плакат с QR-кодом для независимой оценки качества работы Центра «РАСсвет»" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Rating;
