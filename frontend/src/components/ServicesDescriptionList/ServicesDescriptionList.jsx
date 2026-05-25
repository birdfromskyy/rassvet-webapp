import { useState, useEffect } from "react";
import "./ServicesDescriptionList.scss";
import { serviceCmsService, siteSettingService } from "../../services/cmsService";

const parseJson = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

function ServicesDescriptionList() {
  const [ourServices, setOurServices] = useState([]);
  const [descriptions, setDescriptions] = useState([]);

  useEffect(() => {
    Promise.all([
      serviceCmsService.getAll("about_services").catch(() => []),
      siteSettingService.getAll().catch(() => ({})),
    ]).then(([cards, settings]) => {
      if (cards?.length) setDescriptions(cards);
      const list = parseJson(settings.about_our_services || "[]");
      setOurServices(list);
    });
  }, []);

  return (
    <section className="servicesDesc">
      <div className="container">

        {ourServices.length > 0 && (
          <div className="servicesDesc__ourServices">
            <h2>Наши услуги:</h2>
            <ul className="servicesDesc__ourList">
              {ourServices.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {descriptions.length > 0 && (
          <div className="servicesDesc__grid">
            {descriptions.map((service, index) => (
              <article className="serviceDescCard" key={service.id || index}>
                <div className="serviceDescCard__top">
                  <div>
                    <h3>{service.title}</h3>
                  </div>
                </div>

                {service.text && <p>{service.text}</p>}

                <ul>
                  {(Array.isArray(service.items) ? service.items : parseJson(service.items)).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ServicesDescriptionList;
