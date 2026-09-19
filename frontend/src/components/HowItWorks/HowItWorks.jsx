import "./HowItWorks.scss";

const steps = [
  {
    number: "01",
    title: "Свяжитесь с нами",
    text: "Позвоните или напишите — мы ответим на вопросы и проведём первичную консультацию удалённо.",
  },
  {
    number: "02",
    title: "Заполните анкету",
    text: "Пришлём анкету о ребёнке. Специалисты изучат её и предложат подходящие занятия.",
  },
  {
    number: "03",
    title: "Начните занятия",
    text: "Когда центр будет готов вас принять — позвоним, оформим договор и составим расписание.",
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works">
      <div className="page-container how-it-works__inner">
        <div className="how-it-works__heading">
          <span className="how-it-works__label">Первый шаг</span>
          <h2 className="how-it-works__title">Как попасть в центр</h2>
          <p className="how-it-works__subtitle">
            Мы сопровождаем вас с первого звонка до начала занятий
          </p>
        </div>

        <div className="how-it-works__steps">
          {steps.map((step) => (
            <article key={step.number} className="how-it-works__step">
              <span className="how-it-works__step-number">{step.number}</span>
              <h3 className="how-it-works__step-title">{step.title}</h3>
              <p className="how-it-works__step-text">{step.text}</p>
            </article>
          ))}
        </div>

        <div className="how-it-works__cta">
          <a href="/service-algorithm" className="how-it-works__btn">
            Посмотреть полный алгоритм
          </a>
          <a href="/contacts" className="how-it-works__btn how-it-works__btn--secondary">
            Связаться с нами
          </a>
        </div>
      </div>
    </section>
  );
}
