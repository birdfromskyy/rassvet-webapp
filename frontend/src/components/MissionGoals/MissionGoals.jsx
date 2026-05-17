import { useState, useEffect } from "react";
import "./MissionGoals.scss";
import { siteSettingService } from "../../services/cmsService";

function MissionGoals() {
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    siteSettingService.getByKey("mission_goals")
      .then(({ value }) => {
        try { setGoals(JSON.parse(value)); } catch { setGoals([]); }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="mission-goals">
      <div className="container mission-goals__inner">
        <div className="mission-goals__heading">
          <span className="mission-goals__subtitle">Что важно для нас</span>
          <h2 className="mission-goals__title">Цели центра</h2>
        </div>

        <div className="mission-goals__grid">
          {goals.map((goal, index) => (
            <article className="mission-goal" key={index}>
              <div className="mission-goal__number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <p>{goal}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MissionGoals;
