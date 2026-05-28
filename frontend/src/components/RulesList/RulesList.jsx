import { useState, useEffect } from "react";
import "./RulesList.scss";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";

function RulesList() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    cmsFileService
      .getBySection("rules")
      .then(setRules)
      .catch(() => {});
  }, []);

  return (
    <section className="rules-list">
      <div className="container rules-list__inner">

        <div className="rules-list__grid">
          {rules.map((file) => (
            <a
              key={file.id}
              href={file.file_url ? getUploadUrl(file.file_url) : "#"}
              className="rules-card"
              target="_blank"
              rel="noreferrer"
            >
              <div className="rules-card__icon">PDF</div>

              <div className="rules-card__content">
                <h3>{file.title}</h3>

                <p>
                  {file.description || "Открыть документ"}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RulesList;