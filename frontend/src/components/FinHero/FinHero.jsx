import "./FinHero.scss";
import finHero from "../../assets/fin-hero.png";

function FinHero() {
  return (
    <section className="fin-hero">
      <div className="container fin-hero__inner">
        <div className="fin-hero__content">
          <span className="section-badge">О центре</span>

          <h1 className="fin-hero__title">
            Материально-техническое обеспечение
          </h1>

          <p className="fin-hero__text">
            Центр развития детей с задержками развития «РАСсвет» имеет
            современную материально-техническую базу, которая помогает создавать
            комфортные и безопасные условия для развития детей.
          </p>

          <ul className="fin-hero__list">
            <li>
              Нежилое помещение на 1-м и 2-м этажах здания по адресу:
              г. Ханты-Мансийск, пер. Нагорный, д. 3.
            </li>
            <li>
              Игровая площадка с игровым комплексом для несовершеннолетних.
            </li>
          </ul>
        </div>

        <div className="fin-hero__image-wrap">
          <img
            src={finHero}
            alt="Помещение Центра РАСсвет"
            className="fin-hero__image"
          />
        </div>
      </div>
    </section>
  );
}

export default FinHero;