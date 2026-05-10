import "./MissionHero.scss";
import "./MissionHero.scss";
import missionImg from "../../assets/doodle.png";

function MissionHero() {
  return (
    <section className="mission-hero">
        <div className="mission-hero__bg">
          <span className="circle circle--yellow"></span>
          <span className="circle circle--blue"></span>
          <span className="circle circle--light"></span>
        </div>
      <div className="container mission-hero__inner">
        


        <div className="mission-hero__content">
          <span className="mission-hero__label">Миссия центра</span>

          <h1 className="mission-hero__title">
            Помогаем детям развиваться, а семьям чувствовать поддержку
          </h1>

          <p className="mission-hero__text">
            Миссия Центра «РАСсвет» — улучшение качества жизни семей,
            воспитывающих детей с расстройствами аутистического спектра и
            другими ментальными нарушениями.
          </p>
        </div>

        <div className="mission-hero__image-wrap">
          <img
            src={missionImg}
            alt="Миссия центра"
            className="mission-hero__image"
          />
        </div>
      </div>

      <div className="mission-hero__wave">
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

export default MissionHero;
