import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { siteSettingService } from "../../services/cmsService";
import useReveal from "../../hooks/useReveal";
import "./Mission.scss";

import missionImg from "../../assets/doodle.png";

/* Mission page — new "Rassvet 2.0" design (Skills/Design2.md).
   Content (mission statement + goals) is still driven by the same CMS
   settings as before: `mission_hero_text` and `mission_goals`.
   Natural scroll (not wheel-hijack): the goals count is variable, so
   forcing one-screen-per-gesture could hide overflowing content —
   see Design2.md §5. */

const FONT_LINK_ID = "rv-webfont-manrope";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";

const DEFAULT_MISSION =
  "улучшение качества жизни семей, воспитывающих детей с расстройствами аутистического спектра и другими ментальными нарушениями.";

function Mission() {
  const rootRef = useRef(null);
  const [missionText, setMissionText] = useState("");
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    document.title = "Миссия и цели";
  }, []);

  /* Font used only by redesigned pages — no side effects elsewhere. */
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    siteSettingService
      .getAll()
      .then((settings) => setMissionText(settings.mission_hero_text || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    siteSettingService
      .getByKey("mission_goals")
      .then(({ value }) => {
        try {
          setGoals(JSON.parse(value));
        } catch {
          setGoals([]);
        }
      })
      .catch(() => {});
  }, []);

  useReveal(rootRef, [goals.length]);

  return (
    <div className="mission-page" ref={rootRef}>
      <Header />

      {/* ── Screen 1: mission statement (dark) ─────────────────── */}
      <section className="mp-section mp-hero">
        <div className="mp-hero__glow" aria-hidden="true" />
        <div className="page-container mp-hero__inner">
          <div className="mp-hero__content" data-reveal>
            <span className="mp-tag">Миссия центра</span>
            <h1 className="mp-hero__title">
              Помогаем детям развиваться, а семьям чувствовать поддержку
            </h1>
            <p className="mp-hero__text">
              Миссия Центра «РАСсвет» —{" "}
              {missionText || DEFAULT_MISSION}
            </p>
          </div>

          <div className="mp-hero__visual" data-reveal data-reveal-delay="1">
            <div className="mp-hero__card">
              <img src={missionImg} alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Screen 2: goals (light) ────────────────────────────── */}
      <section className="mp-section mp-goals">
        <div className="page-container mp-goals__inner">
          <div className="mp-goals__head" data-reveal>
            <span className="mp-tag mp-tag--dark">Что важно для нас</span>
            <h2 className="mp-h2">Цели центра</h2>
          </div>

          {goals.length > 0 ? (
            <ol className="mp-goals__grid" data-reveal data-reveal-delay="1">
              {goals.map((goal, index) => (
                <li className="mp-goal" key={index}>
                  <span className="mp-goal__num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{goal}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mp-goals__empty" data-reveal>
              Цели скоро появятся здесь.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Mission;
