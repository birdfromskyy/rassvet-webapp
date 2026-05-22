import { useEffect, useState } from "react";
import "./ServicesList.scss";

function ServicesList() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/services`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.services || data || [])
          .filter((s) => s.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            category: s.title,
            accent: s.text,
            items: (() => { try { return JSON.parse(s.items || "[]"); } catch { return []; } })(),
          }));
        setServices(items);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="servicesList">

      <div className="container">

        <div className="servicesList__grid">

          {services.map((service, index) => (
            <div className="serviceCard" key={index}>

              <div className="serviceCard__top">
                <span>{service.accent}</span>

                <h3>{service.category}</h3>
              </div>

              <ul>
                {service.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

            </div>
          ))}

        </div>

        {/* CTA */}

        <div className="servicesList__cta">

          <div>
            <h2>Нужна помощь с выбором услуги?</h2>

            <p>
              Мы подскажем подходящее направление
              и ответим на все вопросы.
            </p>
          </div>

          <a href="/contacts">
            Связаться с нами
          </a>

        </div>

      </div>

    </section>
  );
}

export default ServicesList;