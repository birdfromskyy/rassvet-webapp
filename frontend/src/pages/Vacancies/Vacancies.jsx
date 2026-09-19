import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import vacancyService from "../../services/vacancyService";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./Vacancies.scss";

const parseList = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return value ? [value] : [];
  }
};

function VacancySection({ title, items }) {
  if (!items?.length) return null;

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
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Вакансии";
  }, []);

  useBrandFont();
  useEffect(() => {
    vacancyService
      .getPublic()
      .then(setVacancies)
      .catch(() => setVacancies([]))
      .finally(() => setLoading(false));
  }, []);

  useReveal(rootRef, [loading, vacancies.length]);

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

          {loading ? (
            <p className="d2-empty" data-reveal>Загрузка...</p>
          ) : vacancies.length === 0 ? (
            <p className="d2-empty" data-reveal>Открытых вакансий пока нет.</p>
          ) : (
          <div className="vp-list">
            {vacancies.map((vacancy) => (
              <article className="vp-card" key={vacancy.id} data-reveal>
                <header className="vp-card__head">
                  <span className="vp-card__badge">Вакансия</span>
                  <h3>{vacancy.title}</h3>
                </header>

                <div className="vp-card__body">
                  <VacancySection title="Образование" items={parseList(vacancy.education)} />
                  <VacancySection title="Опыт" items={parseList(vacancy.experience)} />
                  <VacancySection
                    title="Особые требования"
                    items={parseList(vacancy.requirements)}
                  />
                  <VacancySection
                    title="Должностные обязанности"
                    items={parseList(vacancy.duties)}
                  />
                  <VacancySection
                    title="Пожелания к личным качествам"
                    items={parseList(vacancy.qualities)}
                  />
                  <VacancySection
                    title="Условия работы"
                    items={parseList(vacancy.conditions)}
                  />
                  {(vacancy.contact_phone || vacancy.contact_name || vacancy.contact_messengers) && (
                    <VacancySection
                      title="Контакты"
                      items={[
                        vacancy.contact_phone,
                        vacancy.contact_name,
                        vacancy.contact_messengers,
                      ].filter(Boolean)}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
          )}

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
