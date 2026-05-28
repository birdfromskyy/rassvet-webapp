import React, { useEffect, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./ConsultationRequest.scss";

const ConsultationRequest = ({ user }) => {
  useEffect(() => {
    document.title = "Заявка на консультацию";
  }, []);

  const [formData, setFormData] = useState({
    parentName: user
      ? `${user.last_name || ""} ${user.first_name || ""} ${user.middle_name || ""}`.trim()
      : "",
    phone: "",
    email: user?.email || "",
    childName: "",
    childAge: "",
    contactMethod: "phone",
    message: "",
  });

  const [sent, setSent] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Заявка на консультацию:", formData);

    setSent(true);
  };

  return (
    <div className="page page--consultation">
      <Header />

      <main className="consultation">
        <div className="container consultation__container">
          <section className="consultation__hero">
            <span className="section-badge">Первичная консультация</span>

            <h1>Заявка на консультацию</h1>

            <p>
              Заполните короткую форму, и администрация Центра свяжется с вами,
              чтобы уточнить запрос и подсказать дальнейшие шаги.
            </p>
          </section>

          <section className="consultation__content">
            {sent ? (
              <div className="consultation-success">
                <span className="section-badge">Заявка отправлена</span>

                <h2>Спасибо! Мы свяжемся с вами</h2>

                <p>
                  Администрация Центра рассмотрит заявку и свяжется с вами
                  выбранным способом. После консультации вам подскажут, какие
                  документы нужно подготовить.
                </p>
              </div>
            ) : (
              <form className="consultation-form" onSubmit={handleSubmit}>
                <div className="consultation-form__grid">
                  <label>
                    ФИО родителя *
                    <input
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleChange}
                      required
                      placeholder="Иванова Мария Сергеевна"
                    />
                  </label>

                  <label>
                    Телефон *
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="+7 (___) ___-__-__"
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="example@mail.ru"
                    />
                  </label>

                  <label>
                    Имя ребёнка *
                    <input
                      name="childName"
                      value={formData.childName}
                      onChange={handleChange}
                      required
                      placeholder="Имя ребёнка"
                    />
                  </label>

                  <label>
                    Возраст ребёнка *
                    <input
                      name="childAge"
                      value={formData.childAge}
                      onChange={handleChange}
                      required
                      placeholder="Например: 6 лет"
                    />
                  </label>

                  <label>
                    Удобный способ связи
                    <select
                      name="contactMethod"
                      value={formData.contactMethod}
                      onChange={handleChange}
                    >
                      <option value="phone">Звонок</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                  </label>
                </div>

                <label className="consultation-form__textarea">
                  Что вас беспокоит / какой запрос?
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Кратко опишите ситуацию, особенности ребёнка или интересующие направления"
                  />
                </label>

                <button type="submit">Отправить заявку</button>
              </form>
            )}

            <aside className="consultation-info">
              <h2>Что будет дальше?</h2>

              <ol>
                <li>Администрация свяжется с вами.</li>
                <li>Вы получите первичную консультацию.</li>
                <li>При необходимости вам отправят анкету.</li>
                <li>После рассмотрения запроса подскажут дальнейшие шаги.</li>
              </ol>

              <p>
                Документы не нужно загружать сразу. Их запрашивают после
                первичного общения с администрацией.
              </p>
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ConsultationRequest;