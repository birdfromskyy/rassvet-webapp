import { useState, useEffect } from "react";
import "./ServicesDescriptionList.scss";
import { serviceCmsService } from "../../services/cmsService";

const parseJson = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

function ServicesDescriptionList() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    serviceCmsService.getAll().then(setServices).catch(() => {});
  }, []);

  return (
    <section className="servicesDesc">
      <div className="container">
        <div className="servicesDesc__grid">
          {services.map((service) => (
            <article className="serviceDescCard" key={service.id}>
              <div className="serviceDescCard__top">
                <div className="serviceDescCard__icon">{service.icon}</div>

                <div>
                  <span>Услуга</span>
                  <h3>{service.title}</h3>
                </div>
              </div>

              <p>{service.text}</p>

              <ul>
                {parseJson(service.items).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServicesDescriptionList;
