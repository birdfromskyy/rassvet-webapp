import { useState, useEffect } from "react";
import "./HistoryTimeline.scss";
import { historyService } from "../../services/cmsService";

const parseJson = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

function HistoryTimeline() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    historyService.getAll().then(setEvents).catch(() => {});
  }, []);

  return (
    <section className="history-timeline">
      <div className="page-container history-timeline__inner">
        <div className="history-timeline__heading">
          <h2 className="history-timeline__title">Достижения по годам</h2>
        </div>

        <div className="history-timeline__list">
          {events.map((block) => (
            <article className="history-year" key={block.id}>
              <div className="history-year__date">{block.year}</div>

              <div className="history-year__content">
                {parseJson(block.items).map((item, index) => (
                  <p key={index}>{item}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HistoryTimeline;
