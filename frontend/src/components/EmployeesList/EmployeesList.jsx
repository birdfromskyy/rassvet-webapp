import { useState, useEffect } from "react";
import "./EmployeesList.scss";
import { employeeService, getUploadUrl } from "../../services/cmsService";
import employeePhoto from "../../assets/employee-placeholder.png";

const parseJson = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

function EmployeesList() {
  const [employees, setEmployees] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    employeeService.getAll().then(setEmployees).catch(() => {});
  }, []);

  return (
    <section className="employees-list">
      <div className="page-container employees-list__inner">
        <div className="employees-list__heading">
          <h2 className="employees-list__title">Специалисты центра</h2>
        </div>

        <div className="employees-list__items">
          {employees.map((employee, index) => {
            const isOpen = openIndex === index;
            const qualifications = parseJson(employee.qualifications);
            const education = parseJson(employee.education);
            const name = employee.full_name || employee.name || ''
            const photoSrc = employee.photo_url
              ? getUploadUrl(employee.photo_url)
              : employeePhoto;

            return (
              <article
                className={`employee-card ${isOpen ? "is-open" : ""}`}
                key={employee.id}
              >
                <button
                  type="button"
                  className="employee-card__top"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <div className="employee-card__photo-wrap">
                    <img
                      src={photoSrc}
                      alt={name}
                      className="employee-card__photo"
                      onError={(e) => { e.target.src = employeePhoto; }}
                    />
                  </div>

                  <div className="employee-card__main">
                    <span className="employee-card__category">{employee.category}</span>
                    <h3>{name}</h3>
                  </div>

                  <span className="employee-card__toggle">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen && (
                  <div className="employee-card__details">
                    <div className="employee-card__info">
                      <div className="employee-card__column">
                        <h4>Квалификация/должность</h4>
                        <ul>
                          {qualifications.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="employee-card__column">
                        <h4>Образование</h4>
                        <ul>
                          {education.map((item) => (
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
    </section>
  );
}

export default EmployeesList;
