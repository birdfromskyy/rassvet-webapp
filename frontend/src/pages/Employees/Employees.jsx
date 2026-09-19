import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { employeeService, getUploadUrl } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Employees.scss";

import employeePhoto from "../../assets/employee-placeholder.png";

/* Employees page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & behaviour: employeeService.getAll(), expandable cards
   with qualifications / education / experience. */

const parseJson = (str, fallback = []) => {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

function Employees() {
  const rootRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = "Сотрудники";
  }, []);

  useBrandFont();

  useEffect(() => {
    employeeService.getAll().then(setEmployees).catch(() => {});
  }, []);

  useReveal(rootRef, [employees.length]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <div className="employees-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">О центре</span>
            <h1 className="d2-hero__title">Специалисты центра</h1>
            <p className="d2-hero__text">
              Наша команда — педагоги, психологи, логопеды и дефектологи,
              которые каждый день помогают детям и их семьям.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto ep-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Команда</span>
            <h2 className="d2-h2">Наши специалисты</h2>
          </div>

          {employees.length > 0 ? (
            <div className="ep-list" data-reveal>
              {employees.map((employee, index) => {
                const isOpen = openIndex === index;
                const qualifications = parseJson(employee.qualifications);
                const education = parseJson(employee.education);
                const name = employee.full_name || employee.name || "";
                const hasPhoto = !!employee.photo_url;
                const photoSrc = hasPhoto
                  ? getUploadUrl(employee.photo_url)
                  : employeePhoto;

                return (
                  // No data-reveal here: this card's className changes when it
                  // opens, and React would wipe the reveal's is-in class,
                  // hiding the card. The reveal lives on the list wrapper.
                  <article
                    className={`ep-card${isOpen ? " is-open" : ""}`}
                    key={employee.id}
                  >
                    <button
                      type="button"
                      className="ep-card__top"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`ep-card__photo${
                          hasPhoto ? " is-zoomable" : ""
                        }`}
                        {...(hasPhoto
                          ? {
                              role: "button",
                              tabIndex: 0,
                              title: "Нажмите, чтобы увеличить фото",
                              onClick: (e) => {
                                e.stopPropagation();
                                setLightbox({ src: photoSrc, name });
                              },
                              onKeyDown: (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setLightbox({ src: photoSrc, name });
                                }
                              },
                            }
                          : {})}
                      >
                        <img
                          src={photoSrc}
                          alt={name}
                          onError={(e) => {
                            e.target.src = employeePhoto;
                          }}
                        />
                      </span>
                      <span className="ep-card__id">
                        {employee.category && (
                          <span className="ep-card__category">
                            {employee.category}
                          </span>
                        )}
                        <span className="ep-card__name">{name}</span>
                      </span>
                      <span className="ep-card__toggle" aria-hidden="true" />
                    </button>

                    {isOpen && (
                      <div className="ep-card__details">
                        <div className="ep-card__col">
                          <h4>Квалификация / должность</h4>
                          <ul>
                            {qualifications.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="ep-card__col">
                          <h4>Образование</h4>
                          <ul>
                            {education.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="ep-card__col">
                          <h4>Опыт работы</h4>
                          <ul>
                            <li>{employee.experience}</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="d2-empty" data-reveal>
              Информация о специалистах скоро появится здесь.
            </p>
          )}
        </div>
      </section>

      {lightbox && (
        <div className="ep-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="ep-lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Employees;
