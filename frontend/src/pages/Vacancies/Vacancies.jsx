import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Vacancies.scss";

/* Vacancies page — "Rassvet 2.0" design (Skills/Design2.md).
   Content unchanged: the same in-page vacancies as before. */

const vacancies = [
  {
    title: "Воспитатель на группу кратковременного пребывания",
    education: [
      'Среднее профессиональное или высшее образование в рамках укрупненной группы по направлению "Образование и педагогические науки".',
      "Высшее образование или среднее профессиональное образование и дополнительное профессиональное образование по направлению деятельности в организации.",
    ],
    experience: ["Требования к опыту практической работы не предъявляются."],
    requirements: [
      "Отсутствие судимости за преступления, состав и виды которых установлены законодательством РФ.",
      "Наличие медицинской книжки.",
    ],
    duties: [
      "Уход и присмотр за детьми на группе кратковременного пребывания.",
      "Планирование групповой деятельности.",
      "Проведение групповых мероприятий.",
      "Помощь в гигиенических процедурах и выполнении бытовых рутин.",
      "Сопровождение группы на выездных культурно-досуговых мероприятиях.",
    ],
    qualities: [
      "Аккуратность.",
      "Ответственность.",
      "Добросовестность.",
      "Пунктуальность.",
      "Стрессоустойчивость.",
    ],
    conditions: [
      "Гибкий график.",
      "Официальное трудоустройство.",
      "Бесплатное питание.",
      "Возможность обучения и повышения квалификации за счёт работодателя.",
    ],
    contact: ["+7 (904) 459-31-02", "Оксана Александровна", "MAX"],
  },
  {
    title: "Психолог",
    education: [
      "Высшее образование — бакалавриат.",
      "Высшее образование — бакалавриат непрофильное и дополнительное профессиональное образование по программам профессиональной переподготовки по профилю деятельности.",
    ],
    experience: ["Требования к опыту практической работы не предъявляются."],
    requirements: [
      "Отсутствие судимости за преступления, состав и виды которых установлены законодательством РФ.",
      "Наличие медицинской книжки.",
    ],
    duties: [
      "Проведение индивидуальных коррекционно-развивающих занятий с детьми.",
      "Психологическая диагностика.",
      "Психологическое консультирование.",
      "Психологическая коррекция.",
      "Сопровождение детей на групповых культурно-досуговых мероприятиях.",
    ],
    qualities: [
      "Аккуратность.",
      "Ответственность.",
      "Добросовестность.",
      "Пунктуальность.",
      "Стрессоустойчивость.",
    ],
    conditions: [
      "Гибкий график.",
      "Официальное трудоустройство.",
      "Бесплатное питание.",
      "Возможность обучения и повышения квалификации за счёт работодателя.",
    ],
    contact: ["+7 (904) 459-31-02", "Оксана Александровна", "MAX"],
  },
];

function VacancySection({ title, items }) {
  return (
    <div className="vp-block">
      <h4 className="vp-block__title">{title}</h4>
      <ul className="vp-block__list">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Vacancies() {
  const rootRef = useRef(null);

  useEffect(() => {
    document.title = "Вакансии";
  }, []);

  useBrandFont();
  useReveal(rootRef);

  return (
    <div className="vacancies-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Вакансии</span>
            <h1 className="d2-hero__title">
              Станьте частью команды «РАСсвет»
            </h1>
            <p className="d2-hero__text">
              Мы ищем специалистов, которые любят детей, готовы развиваться и
              помогать семьям на пути к новым возможностям.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto vp-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">Открытые вакансии</span>
            <h2 className="d2-h2">Присоединяйтесь к нам</h2>
          </div>

          <div className="vp-list">
            {vacancies.map((vacancy) => (
              <article className="vp-card" key={vacancy.title} data-reveal>
                <header className="vp-card__head">
                  <span className="vp-card__badge">Вакансия</span>
                  <h3>{vacancy.title}</h3>
                </header>

                <div className="vp-card__body">
                  <VacancySection title="Образование" items={vacancy.education} />
                  <VacancySection title="Опыт" items={vacancy.experience} />
                  <VacancySection
                    title="Особые требования"
                    items={vacancy.requirements}
                  />
                  <VacancySection
                    title="Должностные обязанности"
                    items={vacancy.duties}
                  />
                  <VacancySection
                    title="Пожелания к личным качествам"
                    items={vacancy.qualities}
                  />
                  <VacancySection
                    title="Условия работы"
                    items={vacancy.conditions}
                  />
                  {vacancy.contact && (
                    <VacancySection title="Контакты" items={vacancy.contact} />
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="vp-cta" data-reveal>
            <div>
              <h3>Заинтересовала вакансия?</h3>
              <p>
                Свяжитесь с нами любым удобным способом. Мы ответим на ваши
                вопросы, расскажем подробнее об условиях работы и договоримся о
                собеседовании.
              </p>
            </div>
            <Link to="/contacts" className="d2-btn d2-btn--yellow">
              Перейти в контакты
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Vacancies;
