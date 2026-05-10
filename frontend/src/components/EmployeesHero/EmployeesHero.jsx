import "./EmployeesHero.scss";
import employeesImg from "../../assets/employees.png";

function EmployeesHero() {
  return (
    <section className="employees-hero">
      <div className="container employees-hero__inner">
        <div className="employees-hero__content">
          <span className="employees-hero__label">Сотрудники</span>

          <h1 className="employees-hero__title">
            Команда специалистов, которая помогает детям развиваться
          </h1>

          <p className="employees-hero__text">
            В центре работают педагоги, психологи, специалисты по коррекционной
            помощи и сопровождению семей.
          </p>
        </div>

        <div className="employees-hero__image-wrap">
          <img
            src={employeesImg}
            alt="Сотрудники центра"
            className="employees-hero__image"
          />
        </div>
      </div>

      <div className="employees-hero__bg">
        <span className="employees-circle employees-circle--yellow"></span>
        <span className="employees-circle employees-circle--blue"></span>
        <span className="employees-circle employees-circle--light"></span>
      </div>

      <div className="employees-hero__wave">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,70 C240,20 480,110 720,70 C960,30 1200,90 1440,45 L1440,120 L0,120 Z"
            fill="#dfe7ee"
          />
        </svg>
      </div>
    </section>
  );
}

export default EmployeesHero;