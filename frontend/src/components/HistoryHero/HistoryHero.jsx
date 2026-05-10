import "./HistoryHero.scss";
import historyImg from "../../assets/history.png";

function HistoryHero() {
  return (
    <section className="history-hero">
      <div className="container history-hero__inner">
        <div className="history-hero__content">
          <span className="history-hero__label">История и достижения</span>

          <h1 className="history-hero__title">
            Маленькими шагами к большим возможностям
          </h1>

          <p className="history-hero__text">
            Центр «РАСсвет» развивается через проекты, победы детей, поддержку
            семей и участие в социально значимых инициативах.
          </p>
        </div>

        <div className="history-hero__image-wrap">
          <img
            src={historyImg}
            alt="История центра"
            className="history-hero__image"
          />
        </div>
      </div>

      <div className="history-hero__bg">
        <span className="history-circle history-circle--yellow"></span>
        <span className="history-circle history-circle--blue"></span>
        <span className="history-circle history-circle--light"></span>
      </div>

      <div className="history-hero__wave">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,70 C240,20 480,110 720,70 C960,30 1200,90 1440,45 L1440,120 L0,120 Z"
            fill="#dfe7ee"
          />
        </svg>
      </div>
    </section>
  );
}

export default HistoryHero;
