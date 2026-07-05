import { useEffect, useRef } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import ContactsInfo from "../../components/ContactsInfo/ContactsInfo";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Contacts.scss";

/* Contacts page — "Rassvet 2.0" design (Skills/Design2.md).
   Reuses the data-driven <ContactsInfo/> (restyled in scope) and adds
   a dark hero and a map. */

function Contacts() {
  const rootRef = useRef(null);

  useEffect(() => {
    document.title = "Контакты";
  }, []);

  useBrandFont();
  useReveal(rootRef);

  return (
    <div className="contacts-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Контакты</span>
            <h1 className="d2-hero__title">Свяжитесь с нами</h1>
            <p className="d2-hero__text">
              Мы всегда на связи — звоните, пишите или приезжайте. Ниже собраны
              все контакты и режим работы центра «РАСсвет».
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto ct-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Контактные данные</span>
            <h2 className="d2-h2">Как с нами связаться</h2>
          </div>
        </div>

        <div data-reveal>
          <ContactsInfo />
        </div>

        <div className="page-container">
          <div className="ct-map" data-reveal>
            <iframe
              src="https://yandex.ru/map-widget/v1/?ll=69.018902%2C61.004170&z=16&mode=search&text=Ханты-Мансийск%20пер.%20Нагорный%203"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              loading="lazy"
              title="Карта проезда к Центру РАСсвет"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Contacts;
