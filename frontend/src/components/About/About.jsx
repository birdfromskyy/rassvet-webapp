import "./About.scss";
import illustration from "../../assets/sea-and-sun.png";

function About() {

  return (
    <section className="about">
      <div className="about__wave-top"></div>

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
            <li>Целевая аудитория – дети с расстройствами аутистического спектра и прочими ментальными нарушениями.</li>
            <li>Являемся поставщиком социальных услуг.</li>
            <li>
              Сопровождаем семьи по индивидуальным программам предоставления
              социальных услуг.
            </li>
          </ul>

          <a href="#" className="about__btn">
            Подробнее о центре
          </a>
        </div>
      </div>

    </section>
  );
}

export default About;