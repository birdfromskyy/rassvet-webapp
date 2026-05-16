import "./MissionGoals.scss";

const goals = [
  "Развивать самостоятельность ребёнка через формирование бытовых, социальных и коммуникативных навыков.",
  "Повышать компетентность родителей в вопросах развития, воспитания и поддержки ребёнка.",
  "Создавать условия, при которых родители могут сохранять активную социальную и трудовую жизнь.",
  "Формировать профессиональное сообщество специалистов, работающих с детьми с особенностями развития.",
];

function MissionGoals() {
  return (
    <section className="mission-goals">
      <div className="container mission-goals__inner">
        <div className="mission-goals__heading">
          <span className="section-badge">Что важно для нас</span>
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