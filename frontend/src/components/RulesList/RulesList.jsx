import { useState, useEffect } from "react";
import "./RulesList.scss";
import { cmsFileService, getUploadUrl } from "../../services/cmsService";

function RulesList() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    cmsFileService.getBySection("rules").then(setRules).catch(() => {});
  }, []);

  return (
    <section className="rules">
      <div className="container">
        <div className="rules__grid">
          {rules.map((item) => (
            <article className="rulesCard" key={item.id}>
              <div className="rulesCard__icon">PDF</div>

              <div className="rulesCard__content">
                <h2>{item.title}</h2>
                {item.description && <p>{item.description}</p>}

                <a
                  href={item.file_url ? getUploadUrl(item.file_url) : "#"}
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

export default RulesList;
