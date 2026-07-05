import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { serviceCmsService, siteSettingService } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./ServicesDescription.scss";

/* Services description page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data: about_services CMS cards + about_our_services setting. */

const parseJson = (str, fallback = []) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

function ServicesDescription() {
  const rootRef = useRef(null);
  const [ourServices, setOurServices] = useState([]);
  const [descriptions, setDescriptions] = useState([]);

  useEffect(() => {
    document.title = "Описание услуг";
  }, []);

  useBrandFont();

  useEffect(() => {
    Promise.all([
      serviceCmsService.getAll("about_services").catch(() => []),
      siteSettingService.getAll().catch(() => ({})),
    ]).then(([cards, settings]) => {
      if (cards?.length) setDescriptions(cards);
      setOurServices(parseJson(settings.about_our_services || "[]"));
    });
  }, []);

  useReveal(rootRef, [descriptions.length, ourServices.length]);

  return (
    <div className="servicesdesc-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Услуги центра</span>
            <h1 className="d2-hero__title">Описание услуг</h1>
            <p className="d2-hero__text">
              Центр предоставляет услуги в соответствии с{" "}
              <a
                className="sd-link"
                href="https://depsr.admhmao.ru/dokumenty/hmao/postanovleniya-pravitelstva-hmao/398875/"
                target="_blank"
                rel="noreferrer"
              >
                постановлением Правительства ХМАО — Югры
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto sd-section">
        <div className="page-container">
          {ourServices.length > 0 && (
            <div className="sd-our" data-reveal>
              <div className="d2-head">
                <span className="d2-tag d2-tag--dark">Наши услуги</span>
                <h2 className="d2-h2">Что мы предлагаем</h2>
              </div>
              <ul className="sd-our__list">
                {ourServices.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {descriptions.length > 0 ? (
            <div className="sd-grid">
              {descriptions.map((service, index) => {
                const items = Array.isArray(service.items)
                  ? service.items
                  : parseJson(service.items);
                return (
                  <article
                    className="sd-card"
                    key={service.id || index}
                    data-reveal
                  >
                    <h3 className="sd-card__title">{service.title}</h3>
                    {service.text && <p className="sd-card__text">{service.text}</p>}
                    {items.length > 0 && (
                      <ul className="sd-card__list">
                        {items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            ourServices.length === 0 && (
              <p className="d2-empty" data-reveal>
                Описание услуг скоро появится здесь.
              </p>
            )
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ServicesDescription;
