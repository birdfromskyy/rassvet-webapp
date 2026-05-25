import { useEffect, useState } from "react";
import "./ServicesList.scss";

const parseJson = (str) => { try { return JSON.parse(str || "[]"); } catch { return []; } };

function ServicesList() {
  const [sections, setSections] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/services?type=services_list`)
      .then((r) => r.json())
      .then((data) => {
        const all = (data || []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
        const top = all.filter((s) => !s.parent_id);
        const built = top.map((section) => ({
          ...section,
          children: all
            .filter((s) => s.parent_id === section.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((child) => ({ ...child, subItems: parseJson(child.items) })),
        }));
        setSections(built);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="servicesList">
      <div className="container">
        <div className="servicesList__grid">
          {sections.map((section) => (
            <div className="serviceCard" key={section.id}>
              <div className="serviceCard__top">
                <h3>{section.title}</h3>
              </div>
              {section.children.length > 0 && (
                <ul>
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <strong>{child.title}</strong>
                      {child.text && <span> — {child.text}</span>}
                      {child.subItems.length > 0 && (
                        <ul style={{ marginTop: 6 }}>
                          {child.subItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="servicesList__cta">
          <div>
            <h2>Нужна помощь с выбором услуги?</h2>
            <p>Мы подскажем подходящее направление и ответим на все вопросы.</p>
          </div>
          <a href="/contacts">Связаться с нами</a>
        </div>
      </div>
    </section>
  );
}

export default ServicesList;
