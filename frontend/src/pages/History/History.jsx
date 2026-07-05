import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { historyService } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./History.scss";

import historyImg from "../../assets/history.png";

/* History page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data as before: historyService.getAll() → year blocks with a
   JSON `items` array. Natural scroll (variable content). */

const parseJson = (str, fallback = []) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

function History() {
  const rootRef = useRef(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    document.title = "История и достижения";
  }, []);

  useBrandFont();

  useEffect(() => {
    historyService.getAll().then(setEvents).catch(() => {});
  }, []);

  useReveal(rootRef, [events.length]);

  return (
    <div className="history-page" ref={rootRef}>
      <Header />

      {/* ── Screen 1: hero (dark) ──────────────────────────────── */}
      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">История и достижения</span>
            <h1 className="d2-hero__title">
              Маленькими шагами к большим возможностям
            </h1>
            <p className="d2-hero__text">
              Центр «РАСсвет» развивается через проекты, победы детей, поддержку
              семей и участие в социально значимых инициативах.
            </p>
          </div>

          <div className="d2-hero__visual" data-reveal data-reveal-delay="1">
            <div className="d2-hero__card">
              <img src={historyImg} alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Screen 2: timeline (light) ─────────────────────────── */}
      <section className="d2-section d2-section--auto hp-timeline">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">По годам</span>
            <h2 className="d2-h2">Достижения по годам</h2>
          </div>

          {events.length > 0 ? (
            <ol className="hp-line">
              {events.map((block) => (
                <li className="hp-item" key={block.id} data-reveal>
                  <div className="hp-item__marker" aria-hidden="true" />
                  <div className="hp-item__year">{block.year}</div>
                  <div className="hp-item__card">
                    {parseJson(block.items).map((item, index) => (
                      <p key={index}>{item}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="d2-empty" data-reveal>
              События скоро появятся здесь.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default History;
