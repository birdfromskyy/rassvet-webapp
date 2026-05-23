import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./ServiceAlgorithm.scss";

const steps = [
  {
    number: "01",
    title: "Получите ИППСУ",
    text: "Обратитесь в КУ «Агентство социального благополучия населения Югры» для оформления индивидуальной программы предоставления социальных услуг.",
  },
  {
    number: "02",
    title: "Подготовьте документы",
    text: "Понадобятся копии ИППСУ, свидетельства о рождении и СНИЛС ребёнка, паспорта и СНИЛС родителя или законного представителя.",
  },
  {
    number: "03",
    title: "Выберите удобный способ",
    text: "Загрузите документы самостоятельно в личном кабинете или свяжитесь с администрацией Центра.",
  },
  {
    number: "04",
    title: "Согласуйте услуги",
    text: "Специалисты помогут определить перечень и периодичность получения услуг.",
  },
  {
    number: "05",
    title: "Заключите договор",
    text: "После согласования оформляется договор на предоставление социальных услуг.",
  },
  {
    number: "06",
    title: "Начните занятия",
    text: "После оформления документов ребёнок может приступить к занятиям по согласованному расписанию.",
  },
];

function ServiceAlgorithm() {
  return (
    <>
      <Header />

      <main className="serviceAlgorithm">
        <section className="serviceAlgorithm__hero">
          <div className="container serviceAlgorithm__hero-inner">
            <div>
              <span className="section-badge">
                Получение услуг
              </span>

              <h1>Алгоритм получения услуг</h1>

              <p>
                Пошаговая инструкция для родителей: как оформить документы,
                согласовать услуги и начать занятия в Центре «РАСсвет».
              </p>
            </div>
          </div>
        </section>

        <section className="serviceAlgorithm__steps">
          <div className="container">
            <div className="serviceAlgorithm__grid">
              {steps.map((step) => (
                <article className="algorithmCard" key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>

            <div className="serviceAlgorithm__actions">
              <div>
                <h2>Готовы подать документы?</h2>
                <p>
                  Загрузите документы через личный
                  кабинет или свяжитесь с нами.
                </p>
              </div>

              <div className="serviceAlgorithm__buttons">
                <a href="/dashboard">Перейти в личный кабинет</a>
                <a href="/contacts" className="serviceAlgorithm__button-secondary">
                  Связаться с нами
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default ServiceAlgorithm;