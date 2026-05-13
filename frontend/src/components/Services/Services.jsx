import "./Services.scss";
import { useState } from "react";

import iconPedagogic from "../../assets/service1.png";
import iconMedical from "../../assets/service2.png";
import iconPsychologic from "../../assets/service3.png";
import iconAdaptation from "../../assets/adaptation.png";


const servicesData = [
  {
    id: 1,
    title: "Социально-бытовые",
    icon: iconPedagogic,
    shortText: "Оказываем поддержку в повседневной жизни ребёнка: помогаем в уходе, бытовых действиях и формировании навыков самообслуживания.",
    items: [
      "Обеспечение кратковременного присмотра",
      "Помощь в пользовании туалетом или судном",
      "Смена абсорбирующего белья",
      "Помощь в одевании и переодевании",
      "Обтирание, обмывание, гигиеническая ванна",
      "Помощь в умывании",
      "Помощь в приеме пищи",
    ],
  },
  {
    id: 2,
    title: "Социально-психологические",
    icon: iconPsychologic,
    shortText:
      "Социально-психологическое консультирование, включая диагностику и коррекцию.",
    items: [],
  },
  {
    id: 3,
    title: "Социально-медицинские",
    icon: iconMedical,
    shortText:
      "Мероприятия, направленные на поддержание здоровья, развитие двигательных навыков и общее самочувствие.",
    items: [
      "Систематическое наблюдение за получателем социальных услуг в целях выявления отклонений в состоянии из здоровья",
      "Ручной и механический массаж",
      "Мероприятия по формированию здорового образа жизни",
      "Занятия по адаптивной физкультуре",
    ],
  },
    {
    id: 4,
    title: "Развитие коммуникативных навыков",
    icon: iconAdaptation,
    shortText:
      "Комплекс мероприятий, направленных на развитие общения, социальной адаптации и самостоятельности ребёнка.",
    items: [
      "Проведение оздоровительных мероприятий",
      "Проведение досуга",
      "Логопедическая помощь",
      "Социально-педагогическое консультирование и диагностика, включая коррекцию",
      "Психологическое консультирование и коррекция",
      "Психологическая реабилитационно-экспертная диагностика",
      "Трудотерапия",
      "Занятие в сенсорной комнате",
      "Разработка индивидуальных рекомендаций по дальнейшей жизнедеятельности в постреабилитационный период",
      "Динамический контроль процесса реабилитации",
      "Обучение навыкам поведения в быту и общественных местах",
      "Оказание помощи в обучении навыкам компьютерной грамотности"
    ],
  },
];

function Services() {
  const [openId, setOpenId] = useState(0);

  const toggleCard = (id, items) => {
    if (!items || items.length === 0) return;
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="services">
      <div className="container services__inner">
        <div className="services__heading">
          <h2 className="services__title">Наши услуги</h2>
        </div>

        <div className="services__grid">
          {servicesData.map((service) => {
            const isOpen = openId === service.id;

            return (
              <article
                className={`services__card ${isOpen ? "is-open" : ""}`}
                key={service.id}
              >
                <button
                  type="button"
                  className="services__card-top"
                  onClick={() => toggleCard(service.id, service.items)}
                  aria-expanded={isOpen}
                >
                  <div className="services__icon-wrap">
                    <img src={service.icon} alt="" className="services__icon" />
                  </div>
                  <div className="services__card-head">
                    <h3 className="services__card-title">{service.title}</h3>
                    <p className="services__card-text">{service.shortText}</p>
                  </div>
                  {service.items.length > 0 && (
                    <span className="services__toggle">
                      {isOpen ? "−" : "+"}
                    </span>
                  )}{" "}
                </button>

                <div
                  className={`services__card-body ${isOpen ? "is-open" : ""}`}
                >
                  <ul className="services__list">
                    {service.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Services;
