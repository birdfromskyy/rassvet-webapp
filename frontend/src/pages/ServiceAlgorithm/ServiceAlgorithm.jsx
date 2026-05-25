import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./ServiceAlgorithm.scss";

const steps = [
  {
    number: "01",
    title: "Свяжитесь с нами",
    text: "Позвоните или напишите — мы ответим на все вопросы и проведём первичную консультацию удалённо, в удобное для вас время.",
  },
  {
    number: "02",
    title: "Заполните анкету",
    text: "Мы пришлём анкету с вопросами о ребёнке. На её основе специалисты подберут оптимальный состав занятий и запишут вас.",
  },
  {
    number: "03",
    title: "Мы свяжемся с вами",
    text: "Как только центр будет готов принять вашего ребёнка, мы позвоним и согласуем удобное время для начала занятий.",
  },
  {
    number: "04",
    title: "Подготовьте документы",
    text: "Понадобятся: ИППСУ, свидетельство о рождении и СНИЛС ребёнка, паспорт и СНИЛС родителя или законного представителя.",
  },
  {
    number: "05",
    title: "Заключите договор",
    text: "После проверки документов администрация оформит договор на предоставление социальных услуг.",
  },
  {
    number: "06",
    title: "Начните занятия",
    text: "Специалисты подберут оптимальное расписание — и ребёнок может приступать к занятиям.",
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
                <Link to="/dashboard">Перейти в личный кабинет</Link>
                <Link to="/contacts" className="serviceAlgorithm__button-secondary">
                  Связаться с нами
                </Link>
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