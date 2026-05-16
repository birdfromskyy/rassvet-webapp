import "./AvailableHero.scss";
import availableImg from "../../assets/available-hero.png";

function AvailableHero() {
  return (
    <section className="availableHero">
      <div className="container availableHero__inner">
        <div className="availableHero__content">
          <span className="section-badge">Свободные места</span>

          <h1>
            Количество свободных мест в организации для предоставления
            социальных услуг
          </h1>

          <p>
            Актуальная информация о доступных местах по формам обслуживания и
            источникам финансирования.
          </p>
        </div>
      </div>
    </section>
  );
}

export default AvailableHero;