import "./ServicesDescriptionHero.scss";
import servicesImg from "../../assets/services-description.png";

function ServicesDescriptionHero() {
  return (
    <section className="servicesDescHero">
      <div className="container servicesDescHero__inner">
        <div className="servicesDescHero__content">
          <span className="servicesDescHero__badge">Услуги Центра</span>

          <h1>Описание услуг</h1>

<p>
  Центр предоставляет услуги в соответствии с{" "}
  <a
    href="ССЫЛКА_НА_ДОКУМЕНТ"
    target="_blank"
    rel="noreferrer"
  >
    Постановлением от 6 сентября 2014 года №326-п «О порядке предоставления социальных услуг поставщиками социальных услуг в Ханты-Мансийском автономном округе – Югре»
  </a>.
</p>
        </div>

        <img
          src={servicesImg}
          alt=""
          className="servicesDescHero__image"
        />
      </div>
    </section>
  );
}

export default ServicesDescriptionHero;