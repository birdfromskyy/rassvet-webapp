import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Docs.scss";

import docsImg from "../../assets/docs.png";

/* Docs page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & links as before: cmsFileService.getBySection("docs"),
   each card opens getUploadUrl(file.file_url) in a new tab. */

function Docs() {
  const rootRef = useRef(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    document.title = "Документы";
  }, []);

  useBrandFont();

  useEffect(() => {
    cmsFileService.getBySection("docs").then(setFiles).catch(() => {});
  }, []);

  useReveal(rootRef, [files.length]);

  return (
    <div className="docs-page" ref={rootRef}>
      <Header />

      {/* ── Screen 1: hero (dark) ──────────────────────────────── */}
      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Документы</span>
            <h1 className="d2-hero__title">
              Важная информация о работе центра
            </h1>
            <p className="d2-hero__text">
              Здесь собраны основные документы организации: сведения о социальных
              услугах, тарифах, правилах, планах и условиях работы центра.
            </p>
          </div>

          <div className="d2-hero__visual" data-reveal data-reveal-delay="1">
            <div className="d2-hero__card">
              <img src={docsImg} alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Screen 2: documents (light) ────────────────────────── */}
      <section className="d2-section d2-section--auto dp-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Файлы</span>
            <h2 className="d2-h2">Документы центра</h2>
          </div>

          {files.length > 0 ? (
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

export default Docs;
