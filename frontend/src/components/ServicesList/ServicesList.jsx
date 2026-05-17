import "./ServicesList.scss";

const services = [
  {
    category: "Социально-бытовые",
    accent: "Поддержка в повседневной жизни",
    items: [
      "Уход и присмотр за детьми",
      "Помощь в приёме пищи",
      "Организация досуга",
      "Сопровождение детей",
    ],
  },

  {
    category: "Социально-медицинские",
    accent: "Поддержка здоровья и развития",
    items: [
      "Контроль состояния ребёнка",
      "Содействие в оздоровительных мероприятиях",
      "Поддержка двигательной активности",
      "Сенсорно-моторная интеграция",
    ],
  },

  {
    category: "Социально-психологические",
    accent: "Эмоциональная и психологическая помощь",
    items: [
      "Психологическое консультирование",
      "Психологическая коррекция",
      "Поддержка семьи",
      "Развитие коммуникативных навыков",
    ],
  },

  {
    category: "Социально-педагогические",
    accent: "Обучение и развитие навыков",
    items: [
      "АВА-терапия",
      "Логопедия",
      "Обучение компьютерной грамотности",
      "Развитие академических навыков",
    ],
  },
];

function ServicesList() {
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