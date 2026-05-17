import "./About.scss";
import illustration from "../../assets/sea-and-sun.png";

function About() {
  return (
    <section className="about">
      <div className="about__wave about__wave--top" aria-hidden="true">
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path d="M0,0H1440V42C1320,62 1210,72 1080,58C930,42 820,12 680,28C520,46 420,88 250,78C145,72 70,48 0,58Z" />
        </svg>
      </div>
      <div className="container about__inner">
        <div className="about__illustration">
          <img src={illustration} alt="Иллюстрация о центре" />
        </div>

        <div className="about__content">
          <div className="about__badge">О нашем центре</div>

          <h2 className="about__title">
            Создаём возможности для полноценного развития
          </h2>

          <p className="about__text">
            Помогаем детям с задержками развития адаптироваться в обществе,
            раскрывать потенциал и чувствовать себя увереннее в каждом шаге.
          </p>

          <ul className="about__list">
            <li>Работаем с 1 октября 2021 года.</li>
            <li>
              Целевая аудитория – дети с расстройствами аутистического спектра и
              прочими ментальными нарушениями.
            </li>
            <li>Являемся поставщиком социальных услуг.</li>
            <li>
              Сопровождаем семьи по индивидуальным программам предоставления
              социальных услуг.
            </li>
          </ul>

          <a href="/mission" className="about__btn">
            Подробнее о центре
          </a>
        </div>
      </div>
      <div className="about__wave about__wave--bottom" aria-hidden="true">
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path d="M0,52C120,30 240,18 380,34C540,52 640,92 800,78C960,64 1060,22 1220,30C1320,36 1390,54 1440,68V110H0Z" />
        </svg>
      </div>
    </section>
  );
}

export default About;
