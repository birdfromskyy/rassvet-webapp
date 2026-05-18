import "./Footer.scss";
import footerWave from "../../assets/hero-wave.png";
import footerLogo from "../../assets/logo-footer.png";
import footerHouse from "../../assets/footer-house.png";
import vkIcon from "../../assets/vk-icon.png";
import maxIcon from "../../assets/max-icon.png";

export default function Footer() {
  return (
    <>
      <img src={footerWave} alt="" className="footer__wave" />
      
      <footer className="footer">
        
        <div className="footer__inner">
        <div className="container footer__content">
          <div className="footer__col footer__brand">
            <img src={footerLogo} alt="РАСсвет" className="footer__logo" />
          </div>

          <div className="footer__col">
            <h4>О центре</h4>
            <a href="/mission">Миссия и цели</a>
            <a href="/history">История и достижения</a>
            <a href="/docs">Документы</a>
            <a href="/employees">Сотрудники</a>
            <a href="/structure">Структура организации</a>
          </div>

          <div className="footer__col">
            <h4>Услуги</h4>
            <a href="/services-list">Перечень услуг</a>
            <a href="/services-description">Описание услуг</a>
          </div>

          <div className="footer__col">
            <h4>Контакты</h4>

            <a href="tel:+79003973459" className="footer__contact-link">
              +7 (900) 397-34-59
            </a>

            <a href="tel:+79044593102" className="footer__contact-link">
              +7 (904) 459-31-02
            </a>

            <p className="footer__address">
              ХМАО - Югра, г. Ханты-Мансийск,
              <br />
              пер. Нагорный, д. 3
            </p>

            <a href="mailto:vkarpol@yandex.ru" className="footer__contact-link">
              vkarpol@yandex.ru
            </a>

            <div className="footer__socials">
              <a target="_blank" href="https://vk.com/rassvethm?w=club228149734" className="footer__social-link" aria-label="VK">
                <img src={vkIcon} alt="VK" />
              </a>
              <a href="#" className="footer__social-link" aria-label="MAX">
                <img src={maxIcon} alt="MAX" />
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="container">
            <p>
              © Центр развития детей с задержками развития «РАСсвет» 2026 г. |
              ИП Евланова О. А.
            </p>
          <img src={footerHouse} alt="" className="footer__decor" />
          </div>
        </div>
          </div>
      </footer>
      </>
  );
}
