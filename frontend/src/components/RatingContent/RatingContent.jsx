import { useState, useEffect } from "react";
import "./RatingContent.scss";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";

function RatingContent() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    cmsFileService.getBySection("rating").then(setFiles).catch(() => {});
  }, []);

  return (
    <section className="rating">
      <div className="container">
        <div className="rating__grid">
          {files.map((file, index) => (
            <article className="ratingCard" key={file.id}>
              <div className="ratingCard__icon">PDF</div>

              <div className="ratingCard__content">
                <span>Документ {index + 1}</span>
                <h2>{file.title}</h2>

                <a
                  href={file.file_url ? getUploadUrl(file.file_url) : "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть документ →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RatingContent;
