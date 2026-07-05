import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { siteSettingService } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./AvailablePlaces.scss";

/* Available places page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data: siteSettingService.getAll() → availability stats. */

function AvailablePlaces() {
  const rootRef = useRef(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    document.title = "Свободные места";
  }, []);

  useBrandFont();

  useEffect(() => {
    siteSettingService.getAll().then(setSettings).catch(() => {});
  }, []);

  useReveal(rootRef, [Object.keys(settings).length]);

  const total = settings.available_stats_total || "—";
  const budget = settings.available_stats_budget || "—";
  const personal = settings.available_stats_personal || "—";
  const formText =
    settings.available_stats_form_text ||
    "Полустационарное обслуживание; обслуживание на дому";

  const stats = [
    { label: "Общее количество мест", value: total },
    { label: "За счёт бюджетных ассигнований", value: budget },
    { label: "За счёт средств физических лиц", value: personal },
  ];

  return (
    <div className="places-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Свободные места</span>
            <h1 className="d2-hero__title">
              Количество свободных мест в организации
            </h1>
            <p className="d2-hero__text">
              Актуальная информация о доступных местах по формам обслуживания и
              источникам финансирования.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto pl-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Наличие мест</span>
            <h2 className="d2-h2">Доступные места</h2>
          </div>

          <div className="pl-grid" data-reveal>
            {stats.map((stat) => (
              <div className="pl-stat" key={stat.label}>
                <span className="pl-stat__label">{stat.label}</span>
                <span className="pl-stat__value">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="pl-form" data-reveal>
            <span className="pl-form__label">Форма обслуживания</span>
            <p>{formText}</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default AvailablePlaces;
