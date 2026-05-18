import { useState, useEffect } from "react";
import "./ServicesDescriptionList.scss";
import { serviceCmsService } from "../../services/cmsService";

const fallbackServices = [
  {
    icon: "📌",
    title: "Наши услуги",
    text: "",
    items: [
      "Уход и присмотр за детьми в группах кратковременного пребывания",
      "Психолого-педагогическая поддержка",
      "Логопедия",
      "Адаптивная физкультура",
      "Трудотерапия",
      "Обучение компьютерной грамотности",
      "Сенсорно-моторная интеграция",
      "АВА-терапия",
      "Развитие академических навыков",
      "Поддержка альтернативной коммуникации",
      "Формирование навыков самообслуживания",
      "Групповая игровая деятельность",
      "Занятия продуктивной и творческой деятельностью",
      "Социальная адаптация",
    ],
  },
];

const parseJson = (str, fallback = []) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

function ServicesDescriptionList() {
  const [services, setServices] = useState(fallbackServices);

  useEffect(() => {
    serviceCmsService
      .getAll()
      .then((data) => {
        if (data?.length) {
          setServices(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="servicesDesc">
      <div className="container">
        <div className="servicesDesc__grid">
          {services.map((service, index) => (
            <article
              className="serviceDescCard"
              key={service.id || index}
            >
              <div className="serviceDescCard__top">
                <div className="serviceDescCard__icon">
                  {service.icon}
                </div>

                <div>
                  <h3>{service.title}</h3>
                </div>
              </div>

              <p>{service.text}</p>

              <ul>
                {(Array.isArray(service.items)
                  ? service.items
                  : parseJson(service.items)
                ).map((item, i) => (
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