import "./ContactsInfo.scss";

import userIcon from "../../assets/boss.png";
import phoneIcon from "../../assets/phone.png";
import mailIcon from "../../assets/mail.png";
import mapIcon from "../../assets/map.png";
import clockIcon from "../../assets/clock.png";

function ContactsInfo() {
  return (
    <section className="contacts">
      <div className="container">

        <div className="contacts__grid">

          <div className="contactCard">
            <img src={userIcon} alt="" />

            <h3>Руководство</h3>

            <p>Учредитель: Якубенок Оксана Александровна</p>
            <p>Руководитель: Якубенок Оксана Александровна</p>
          </div>

          <div className="contactCard">
            <img src={phoneIcon} alt="" />

            <h3>Телефоны</h3>

            <p>+7 (900) 397-34-59</p>
            <p>+7 (904) 459-31-02</p>
          </div>

          <div className="contactCard">
            <img src={mailIcon} alt="" />

            <h3>Email</h3>

            <a href="mailto:yakpol@yandex.ru">
              yakpol@yandex.ru
            </a>
          </div>

          <div className="contactCard">
            <img src={mapIcon} alt="" />

            <h3>Адреса</h3>

            <p>
              Юридический: ХМАО - Югра, г. Ханты-Мансийск,
              ул. Промышленная, дом 7, кв. 12
            </p>

            <p>
              Фактический: ХМАО - Югра, г. Ханты-Мансийск,
              пер. Нагорный д.3
            </p>
          </div>

          <div className="contactCard">
            <img src={clockIcon} alt="" />

            <h3>Режим работы</h3>

            <p>Пн–Пт: 08:00 – 18:00</p>
            <p>Сб–Вс: по предварительной записи</p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default ContactsInfo;