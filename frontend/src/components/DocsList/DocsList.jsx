import { useState, useEffect } from "react";
import "./DocsList.scss";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";

function DocsList() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    cmsFileService.getBySection("docs").then(setFiles).catch(() => {});
  }, []);

  return (
    <section className="docs-list">
      <div className="container docs-list__inner">
        <div className="docs-list__heading">
          <span className="docs-list__subtitle">Открытая информация</span>
          <h2 className="docs-list__title">Документы центра</h2>
        </div>

        <div className="docs-list__grid">
          {files.map((file) => (
            <a
              href={file.file_url ? getUploadUrl(file.file_url) : "#"}
              className="docs-card"
              key={file.id}
              target="_blank"
              rel="noreferrer"
            >
              <div className="docs-card__icon">PDF</div>

              <div className="docs-card__content">
                <h3>{file.title}</h3>
                <p>{file.description || "Открыть документ"}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DocsList;
