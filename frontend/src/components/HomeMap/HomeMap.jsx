import "./HomeMap.scss";

function HomeMap() {
  return (
    <section className="home-map">
      <div className="home-map__wave-top">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,40 C240,100 480,0 720,40 C960,80 1200,20 1440,60 L1440,0 L0,0 Z"
            fill="#dbe5ee"
          />
        </svg>
      </div>
      <div className="container">
        <div className="home-map__head">
          <span className="section-badge">Как нас найти</span>
          <h2>Адрес Центра</h2>
          <p>ХМАО — Югра, г. Ханты-Мансийск, пер. Нагорный, д. 3</p>
        </div>

        <div className="home-map__frame">
          <iframe
            src="https://yandex.ru/map-widget/v1/?ll=69.018902%2C61.004170&z=16&mode=search&text=Ханты-Мансийск%20пер.%20Нагорный%203"
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            title="Карта проезда к Центру РАСсвет"
          />
        </div>
      </div>
    </section>
  );
}

export default HomeMap;
