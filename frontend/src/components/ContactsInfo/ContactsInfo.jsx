import "./ContactsInfo.scss";
import { useEffect, useState } from "react";
import { siteSettingService } from "../../services/cmsService";

import userIcon from "../../assets/boss.png";
import phoneIcon from "../../assets/phone.png";
import mailIcon from "../../assets/mail.png";
import mapIcon from "../../assets/map.png";
import clockIcon from "../../assets/clock.png";

// Render multiline text: each non-empty line becomes a separate <p>
function Lines({ text, asLink }) {
  const lines = (text || "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return null;
  return lines.map((line, i) =>
    asLink ? (
      <a key={i} href={`mailto:${line.trim()}`}>{line.trim()}</a>
    ) : (
      <p key={i}>{line}</p>
    )
  );
}

function ContactsInfo() {
  const [s, setS] = useState({});

  useEffect(() => {
    siteSettingService.getAll().then(setS).catch(() => {});
  }, []);

  const management = s.contacts_management ||
    "Учредитель: Якубенок Оксана Александровна\nРуководитель: Якубенок Оксана Александровна";
  const phones = s.contacts_phones ||
    "+7 (900) 397-34-59\n+7 (904) 459-31-02";
  const email = s.contacts_email || "vkarpol@yandex.ru";
  const addresses = s.contacts_addresses ||
    "Юридический: ХМАО - Югра, г. Ханты-Мансийск, ул. Промышленная, дом 7, кв. 12\nФактический: ХМАО - Югра, г. Ханты-Мансийск,\nпер. Нагорный д.3";
  const hours = s.contacts_hours ||
    "Пн–Пт: 08:00 – 18:00\nСб–Вс: по предварительной записи";

  return (
    <section className="contacts">
      <div className="page-container">
        <div className="contacts__grid">

          <div className="contactCard">
            <img src={userIcon} alt="" />
            <h3>Руководство</h3>
            <Lines text={management} />
          </div>

          <div className="contactCard">
            <img src={phoneIcon} alt="" />
            <h3>Телефоны</h3>
            <Lines text={phones} />
          </div>

          <div className="contactCard">
            <img src={mailIcon} alt="" />
            <h3>Email</h3>
            <Lines text={email} asLink />
          </div>

          <div className="contactCard">
            <img src={mapIcon} alt="" />
            <h3>Адреса</h3>
            <Lines text={addresses} />
          </div>

          <div className="contactCard">
            <img src={clockIcon} alt="" />
            <h3>Режим работы</h3>
            <Lines text={hours} />
          </div>

        </div>
      </div>
    </section>
  );
}

export default ContactsInfo;
