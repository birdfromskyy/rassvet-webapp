import { useEffect } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { FiBriefcase, FiClock, FiPhone, FiUserCheck } from "react-icons/fi";
import "./Vacancies.scss";
import { Link } from "react-router-dom";
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
    <div className="vacancy-card__section">
      <h3>{title}</h3>

      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Vacancies() {
  useEffect(() => {
    document.title = "Вакансии";
  }, []);

  return (
    <div className="page page--vacancies">
      <Header />

      <main className="vacancies">
        <section className="vacancies__hero">
          <div className="container vacancies__hero-inner">
            <div>
              <span className="section-badge">Вакансии</span>

              <h1>Станьте частью команды «РАСсвет»</h1>

              <p>
                Мы ищем специалистов, которые любят детей, готовы развиваться и
                помогать семьям на пути к новым возможностям.
              </p>
            </div>
          </div>
        </section>

        <section className="vacancies__list">
          <div className="container">
            <h2 className="vacancies__title">Открытые вакансии</h2>

            <div className="vacancies__grid">
              {vacancies.map((vacancy) => (
                <article className="vacancy-card" key={vacancy.title}>
                  <div className="vacancy-card__top">
                    <span>Вакансия</span>
                    <h2>{vacancy.title}</h2>
                  </div>

                  <VacancySection title="Образование" items={vacancy.education} />
                  <VacancySection title="Опыт" items={vacancy.experience} />
                  <VacancySection title="Особые требования" items={vacancy.requirements} />
                  <VacancySection title="Должностные обязанности" items={vacancy.duties} />
                  <VacancySection title="Пожелания к личным качествам" items={vacancy.qualities} />
                  <VacancySection title="Условия работы" items={vacancy.conditions} />
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="vacancies__contact">
  <div className="container">
    <div className="vacancies__contact-card">
      <h2>Заинтересовала вакансия?</h2>

      <p>
        Свяжитесь с нами любым удобным способом. Мы ответим на ваши вопросы,
        расскажем подробнее об условиях работы и договоримся о собеседовании.
      </p>

      <Link to="/contacts" className="vacancies__contact-btn">
        Перейти в контакты
      </Link>
    </div>
  </div>
</section>
      </main>

      <Footer />
    </div>
  );
}

export default Vacancies;