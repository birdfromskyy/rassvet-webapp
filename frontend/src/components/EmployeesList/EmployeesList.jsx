import { useState } from "react";
import "./EmployeesList.scss";

import employeePhoto from "../../assets/employee-placeholder.png";

const employees = [
  {
    name: "Быкова Алена Олеговна",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: ["Экономист", "Учитель-логопед", "Логопед"],
    education: [
      "Санкт-Петербургский государственный инженерно-экономический университет",
      "АНО ДПО «Северо-Западная Академия дополнительного профессионального образования и профессионального обучения»",
    ],
    experience: "С января 2024",
  },
  {
    name: "Хабарова Елена Алексеевна",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: ["Бухгалтер", "Специалист по социальной работе"],
    education: [
      "ГБПОУ ЯНАО «Ямальский полярный агроэкономический техникум»",
      "ФГБОУ ВО «Югорский государственный университет»",
    ],
    experience: "С ноября 2021",
  },
  {
    name: "Еприна Светлана Владимировна",
    category: "Руководство",
    photo: employeePhoto,
    qualification: ["Преподаватель начальных классов", "Воспитатель"],
    education: [
      "АУ «Ханты-Мансийский технолого-педагогический колледж»",
      "Неоконченное высшее ФГБОУ ВО «Югорский государственный университет»",
    ],
    experience: "С декабря 2025",
  },
  {
    name: "Вагатова Анастасия Степановна",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: [
      "Медицинский брат",
      "Учитель-олигофренопедагог",
      "Специалист по адаптивной физической культуре",
      "Специалист по логомассажу",
      "Мастер косметических видов массажа",
      "Тренер АФК",
    ],
    education: [
      "Министерство здравоохранения Шадринское медицинское училище",
      "ГОУ ВПО «Московский государственный открытый педагогический университет имени М.А. Шолохова»",
      "ФГБОУ ВПО «Курганский государственный университет»",
      "АНО ДПО «Национальный исследовательский институт дополнительного образования и профессионального обучения»",
    ],
    experience: "С августа 2024",
  },
  {
    name: "Соболев Дмитрий Вячеславович",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: [
      "Специалист по социальной работе",
      "Специалист по сенсорной интеграции",
      "Специалист по Прикладному Анализу Поведения уровня IBP-I",
      "Помощник по уходу",
    ],
    education: [
      "ФГБОУ ВО «Югорский государственный университет»",
      "АНО «Национальный исследовательский институт дополнительного образования и профессионального обучения»",
    ],
    experience: "С сентября 2022",
  },
  {
    name: "Хидирова Лейла Акифовна",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: ["Педагог-психолог", "Логопед", "Психолог"],
    education: [
      "ФГБОУ ВО «Югорский государственный университет»",
      "АНО ДПО «Северо-Западная Академия дополнительного профессионального образования и профессионального обучения»",
    ],
    experience: "С октября 2021",
  },
  {
    name: "Зубова Анастасия Сергеевна",
    category: "Специалисты",
    photo: employeePhoto,
    qualification: [
      "Экономист",
      "Специалист по сенсорной интеграции",
      "Тренер АФК",
    ],
    education: [
      "Негосударственное образовательное учреждение высшего профессионального образования «Гуманитарный университет»",
      "АНО «Академия дополнительного профессионального образования»",
      "АНО ДПО «Институт нейропсихологии и нейрофизиологии развития ребенка»",
    ],
    experience: "С октября 2021",
  },
  {
    name: "Жуковская Светлана Вячеславовна",
    category: "Руководство",
    photo: employeePhoto,
    qualification: [
      "Специалист по Прикладному Анализу Поведения уровня BCaBA",
      "Экономист-менеджер",
      "Учитель начальных классов компенсирующего и коррекционно-развивающего образования",
      "Руководитель",
    ],
    education: [
      "Сибирский государственный университет телекоммуникации и информатики",
      "АНО «Академия дополнительного профессионального образования»",
      "Центр Дистанционного Обучения Прикладной Анализ Поведения — АВА",
    ],
    experience: "С октября 2021",
  },
  {
    name: "Якубенок Оксана Александровна",
    category: "Руководство",
    photo: employeePhoto,
    qualification: ["Руководитель центра"],
    education: ["Информация уточняется"],
    experience: "Информация уточняется",
  },
];

function EmployeesList() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section className="employees-list">
      <div className="container employees-list__inner">
        <div className="employees-list__heading">
          <span className="employees-list__subtitle">Наша команда</span>
          <h2 className="employees-list__title">Специалисты центра</h2>
        </div>

        <div className="employees-list__items">
          {employees.map((employee, index) => {
            const isOpen = openIndex === index;

            return (
              <article
                className={`employee-card ${isOpen ? "is-open" : ""}`}
                key={employee.name}
              >
                <button
                  type="button"
                  className="employee-card__top"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <div className="employee-card__photo-wrap">
                    <img
                      src={employee.photo}
                      alt={employee.name}
                      className="employee-card__photo"
                    />
                  </div>

                  <div className="employee-card__main">
                    <span className="employee-card__category">
                      {employee.category}
                    </span>
                    <h3>{employee.name}</h3>
                    <p>{employee.qualification[0]}</p>
                  </div>

                  <span className="employee-card__toggle">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="employee-card__details">
                    <div className="employee-card__info">
                      <div className="employee-card__column">
                        <h4>Квалификация/должность</h4>
                        <ul>
                          {employee.qualification.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="employee-card__column">
                        <h4>Образование</h4>
                        <ul>
                          {employee.education.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="employee-card__column">
                        <h4>Опыт работы</h4>
                        <ul>
                          <li>{employee.experience}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="employees-list__wave-bottom">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,70 C240,20 480,110 720,70 C960,30 1200,90 1440,45 L1440,120 L0,120 Z"
            fill="#074462"
          />
        </svg>
      </div>
    </section>
  );
}

export default EmployeesList;