import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./ServicesListPage.scss";

/* Services list page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & structure: nested service sections from
   /services?type=services_list. */

const parseJson = (str) => {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
};

function ServicesListPage() {
  const rootRef = useRef(null);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    document.title = "Перечень социальных услуг";
  }, []);

  useBrandFont();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/services?type=services_list`)
      .then((r) => r.json())
      .then((data) => {
        const all = (data || [])
          .filter((s) => s.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
        const top = all.filter((s) => !s.parent_id);
        const built = top.map((section) => ({
          ...section,
          children: all
            .filter((s) => s.parent_id === section.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((child) => ({ ...child, subItems: parseJson(child.items) })),
        }));
        setSections(built);
      })
      .catch(() => {});
  }, []);

  useReveal(rootRef, [sections.length]);

  return (
    <div className="serviceslist-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Услуги центра</span>
            <h1 className="d2-hero__title">Перечень социальных услуг</h1>
            <p className="d2-hero__text">
              Центр оказывает социально-бытовые, психологические, педагогические
              и медицинские услуги для детей и их семей.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto sl-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Направления</span>
            <h2 className="d2-h2">Категории услуг</h2>
          </div>

          {sections.length > 0 ? (
            <div className="sl-grid">
              {sections.map((section) => (
                <article className="sl-card" id={`service-${section.id}`} key={section.id} data-reveal>
                  <h3 className="sl-card__title">{section.title}</h3>
                  {section.children.length > 0 && (
                    <ul className="sl-list">
                      {section.children.map((child) => (
                        <li key={child.id}>
                          <strong>{child.title}</strong>
                          {child.text && <span> — {child.text}</span>}
                          {child.subItems.length > 0 && (
                            <ul className="sl-sublist">
                              {child.subItems.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="d2-empty" data-reveal>
              Перечень услуг скоро появится здесь.
            </p>
          )}

          <div className="sl-cta" data-reveal>
            <div>
              <h3>Нужна помощь с выбором услуги?</h3>
              <p>Мы подскажем подходящее направление и ответим на все вопросы.</p>
            </div>
            <a href="/contacts" className="d2-btn d2-btn--yellow">
              Связаться с нами
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ServicesListPage;
