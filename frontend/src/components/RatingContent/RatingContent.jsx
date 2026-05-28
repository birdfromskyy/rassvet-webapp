import { useEffect, useState } from "react";
import "./RatingContent.scss";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";

function RatingContent() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    cmsFileService
      .getBySection("rating")
      .then(setFiles)
      .catch(() => {});
  }, []);

  return (
    <section className="rating-content">
      <div className="container rating-content__inner">

        <div className="rating-content__grid">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.file_url ? getUploadUrl(file.file_url) : "#"}
              className="rating-card"
              target="_blank"
              rel="noreferrer"
            >
              <div className="rating-card__icon">PDF</div>

              <div className="rating-card__content">
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

export default RatingContent;