import "./AvailableStats.scss";

function AvailableStats() {
  return (
    <section className="availableStats">
      <div className="container">

        <div className="availableStats__grid">

          <div className="statCard">
            <span>Общее количество мест</span>
            <h2>60</h2>
          </div>

          <div className="statCard">
            <span>За счёт бюджетных ассигнований</span>
            <h2>0</h2>
          </div>

          <div className="statCard">
            <span>За счёт средств физических лиц</span>
            <h2>0</h2>
          </div>

        </div>

        <div className="availableStats__type">
          <span>Форма обслуживания</span>
          <p>
            Полустационарное обслуживание; обслуживание на дому
          </p>
        </div>

      </div>
    </section>
  );
}

export default AvailableStats;