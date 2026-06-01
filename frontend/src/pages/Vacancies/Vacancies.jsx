import { useEffect, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { FiPhone } from "react-icons/fi";
import "./Vacancies.scss";
import { Link } from "react-router-dom";
import vacancyService from "../../services/vacancyService";

const parseJson = (str) => {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return str ? [str] : [];
  }
};

function VacancySection({ title, items }) {
  if (!items || items.length === 0) return null;
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
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Вакансии";
    vacancyService
      .getPublic()
      .then(setVacancies)
      .catch(() => {})
      .finally(() => setLoading(false));
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

            {loading ? (
              <p style={{ textAlign: "center", color: "#55707f" }}>
                Загрузка...
              </p>
            ) : vacancies.length === 0 ? (
              <p style={{ textAlign: "center", color: "#55707f" }}>
                На данный момент открытых вакансий нет.
              </p>
            ) : (
              <div className="vacancies__grid">
                {vacancies.map((vacancy) => (
                  <article className="vacancy-card" key={vacancy.id}>
                    <div className="vacancy-card__top">
                      <span>Вакансия</span>
                      <h2>{vacancy.title}</h2>
                    </div>

                    <VacancySection
                      title="Образование"
                      items={parseJson(vacancy.education)}
                    />
                    <VacancySection
                      title="Опыт"
                      items={parseJson(vacancy.experience)}
                    />
                    <VacancySection
                      title="Особые требования"
                      items={parseJson(vacancy.requirements)}
                    />
                    <VacancySection
                      title="Должностные обязанности"
                      items={parseJson(vacancy.duties)}
                    />
                    <VacancySection
                      title="Пожелания к личным качествам"
                      items={parseJson(vacancy.qualities)}
                    />
                    <VacancySection
                      title="Условия работы"
                      items={parseJson(vacancy.conditions)}
                    />

                    {(vacancy.contact_phone || vacancy.contact_name) && (
                      <div className="vacancy-card__contact">
                        <FiPhone />
                        <div>
                          <h3>Контактная информация</h3>
                          {vacancy.contact_phone && (
                            <p>{vacancy.contact_phone}</p>
                          )}
                          {vacancy.contact_name && (
                            <p>{vacancy.contact_name}</p>
                          )}
                          {vacancy.contact_messengers && (
                            <p style={{ fontWeight: 400, opacity: 0.8 }}>
                              {vacancy.contact_messengers}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="vacancies__contact">
          <div className="container">
            <div className="vacancies__contact-card">
              <h2>Заинтересовала вакансия?</h2>

              <p>
                Свяжитесь с нами любым удобным способом. Мы ответим на ваши
                вопросы, расскажем подробнее об условиях работы и договоримся о
                собеседовании.
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
