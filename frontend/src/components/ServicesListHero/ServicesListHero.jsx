import "./ServicesListHero.scss";

function ServicesListHero() {
  return (
    <section className="servicesHero">

      <div className="page-container">

        <div className="servicesHero__wrapper">

          {/* LEFT */}

          <div className="servicesHero__content">

            <span className="section-badge">
              Социальные услуги
            </span>

            <h1>
              Перечень
              <br />
              социальных услуг
            </h1>

            <p>
              Центр оказывает социально-бытовые,
              психологические, педагогические
              и развивающие услуги для детей
              с расстройствами аутистического спектра.
            </p>

          </div>

          {/* RIGHT */}

          <div className="servicesHero__visual">

          </div>

        </div>

      </div>

    </section>
  );
}

export default ServicesListHero;