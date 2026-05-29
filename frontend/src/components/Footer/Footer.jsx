import "./Footer.scss";
import footerWave from "../../assets/hero-wave.png";
import footerLogo from "../../assets/logo-footer.png";
import footerHouse from "../../assets/footer-house.png";
import vkIcon from "../../assets/vk-icon.png";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { siteSettingService } from "../../services/cmsService";

export default function Footer() {
  const [s, setS] = useState({});

  useEffect(() => {
    siteSettingService.getAll().then(setS).catch(() => {});
  }, []);

  const phone1 = s.footer_phone1 || "+7 (900) 397-34-59";
  const phone2 = s.footer_phone2 || "+7 (904) 459-31-02";
  const address = s.footer_address || "ХМАО - Югра, г. Ханты-Мансийск,\nпер. Нагорный, д. 3";
  const email = s.footer_email || "vkarpol@yandex.ru";
  const vkUrl = s.footer_vk_url || "https://vk.com/rassvethm?w=club228149734";
  const copyright = s.footer_copyright || "© Центр развития детей с задержками развития «РАСсвет» 2026 г. | ИП Евланова О. А.";
  const toHref = (p) => `tel:${p.replace(/\D/g, "").replace(/^8/, "+7")}`;

  return (
    <>
      <img src={footerWave} alt="" className="footer__wave" />

      <footer className="footer">
        <div className="footer__inner">
          <div className="container footer__content">
            <div className="footer__col footer__brand">
              <Link to="/main">
                <img src={footerLogo} alt="РАСсвет" className="footer__logo" />
              </Link>
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
              <Link to="/contacts">
                <h4>Контакты</h4>
              </Link>

              <a href={toHref(phone1)} className="footer__contact-link">{phone1}</a>
              <a href={toHref(phone2)} className="footer__contact-link">{phone2}</a>

              <p className="footer__address">
                {address.split("\n").map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </p>

              <a href={`mailto:${email}`} className="footer__contact-link">{email}</a>

              <div className="footer__socials">
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={vkUrl}
                  className="footer__social-link"
                  aria-label="VK"
                >
                  <img src={vkIcon} alt="VK" />
                </a>
              </div>
            </div>
          </div>

          <div className="footer__bottom">
            <div className="container">
              <p>{copyright}</p>
              <img src={footerHouse} alt="" className="footer__decor" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
