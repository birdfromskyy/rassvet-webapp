import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./InternalRules.scss";

/* Internal rules page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data as before: cmsFileService.getBySection("rules"). */

function InternalRules() {
  const rootRef = useRef(null);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    document.title = "Правила внутреннего распорядка";
  }, []);

  useBrandFont();

  useEffect(() => {
    cmsFileService.getBySection("rules").then(setRules).catch(() => {});
  }, []);

  useReveal(rootRef, [rules.length]);

  return (
    <div className="rules-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Документы</span>
            <h1 className="d2-hero__title">О правилах внутреннего распорядка</h1>
            <p className="d2-hero__text">
              В данном разделе размещены документы, регулирующие порядок работы
              Центра и правила пребывания получателей социальных услуг.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto rules-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Файлы</span>
            <h2 className="d2-h2">Правила и порядок работы</h2>
          </div>

          {rules.length > 0 ? (
            <div className="d2-files">
              {rules.map((file) => (
                <a
                  href={file.file_url ? getUploadUrl(file.file_url) : "#"}
                  className="d2-file"
                  key={file.id}
                  target="_blank"
                  rel="noreferrer"
                  data-reveal
                >
                  <span className="d2-file__icon" aria-hidden="true">
                    PDF
                  </span>
                  <h3 className="d2-file__title">{file.title}</h3>
                  {file.description && (
                    <p className="d2-file__desc">{file.description}</p>
                  )}
                  <span className="d2-file__foot">
                    <span className="d2-file__open">Открыть документ</span>
                    <span className="d2-file__arrow" aria-hidden="true">
                      ↓
                    </span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="d2-empty" data-reveal>
              Документы скоро появятся здесь.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default InternalRules;
