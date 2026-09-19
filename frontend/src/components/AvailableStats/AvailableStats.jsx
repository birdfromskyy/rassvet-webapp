import { useState, useEffect } from "react";
import "./AvailableStats.scss";
import { siteSettingService } from "../../services/cmsService";

function AvailableStats() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    siteSettingService.getAll().then(setSettings).catch(() => {});
  }, []);

  const total    = settings.available_stats_total    || "—";
  const budget   = settings.available_stats_budget   || "—";
  const personal = settings.available_stats_personal || "—";
  const formText = settings.available_stats_form_text || "Полустационарное обслуживание; обслуживание на дому";

  return (
    <section className="availableStats">
      <div className="page-container">

        <div className="availableStats__grid">

          <div className="statCard">
            <span>Общее количество мест</span>
            <h2>{total}</h2>
          </div>

          <div className="statCard">
            <span>За счёт бюджетных ассигнований</span>
            <h2>{budget}</h2>
          </div>

          <div className="statCard">
            <span>За счёт средств физических лиц</span>
            <h2>{personal}</h2>
          </div>

        </div>

        <div className="availableStats__type">
          <span>Форма обслуживания</span>
          <p>{formText}</p>
        </div>

      </div>
    </section>
  );
}

export default AvailableStats;
