import { useEffect, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useBrandFont from "../../hooks/useBrandFont";
import "./ConsultationRequest.scss";
import consultationService from "../../services/consultationService";

const CONTACT_METHODS = [
  { value: "phone", label: "Звонок" },
  { value: "vk",    label: "ВКонтакте" },
  { value: "max",   label: "MAX" },
  { value: "email", label: "Email" },
];

// Build display string "+7 XXX XXX XX XX" from up to 10 digits after +7
const buildPhoneDisplay = (digits10) => {
  let s = "+7";
  if (digits10.length > 0) s += " " + digits10.slice(0, 3);
  if (digits10.length > 3) s += " " + digits10.slice(3, 6);
  if (digits10.length > 6) s += " " + digits10.slice(6, 8);
  if (digits10.length > 8) s += " " + digits10.slice(8, 10);
  return s;
};

// Display → raw "+7XXXXXXXXXX"
const parsePhone = (display) => {
  const digits = display.replace(/\D/g, "");
  if (digits.length < 2) return "";
  return "+" + digits;
};

const FIO_MIN = 2;
const FIO_MAX = 100;

const ConsultationRequest = ({ user }) => {
  useBrandFont();
  useEffect(() => { document.title = "Заявка на консультацию"; }, []);

  const fullName = user
    ? [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ")
    : "";

  const [form, setForm] = useState({
    parent_fio:     fullName,
    phone:          "",
    child_fio:      "",
    child_age:      "",
    contact_method: "phone",
    contact_email:  user?.email || "",
    request_text:   "",
  });

  // Separate display state for phone formatting
  const [phoneDisplay, setPhoneDisplay] = useState("+7");

  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const isAuth = !!user;

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // Phone handlers — same pattern as Profile page
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const after7 = raw.startsWith("7") ? raw.slice(1) : raw;
    const display = buildPhoneDisplay(after7.slice(0, 10));
    setPhoneDisplay(display);
    setForm((p) => ({ ...p, phone: parsePhone(display) }));
  };

  const handlePhoneKeyDown = (e) => {
    if (e.key === "Backspace" && phoneDisplay === "+7") e.preventDefault();
  };

  const handlePhoneFocus = (e) => {
    if (!phoneDisplay || phoneDisplay === "") setPhoneDisplay("+7");
    setTimeout(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length), 0);
  };

  const validate = () => {
    if (form.parent_fio.trim().length < FIO_MIN) return `ФИО родителя — минимум ${FIO_MIN} символа`;
    if (form.parent_fio.trim().length > FIO_MAX) return `ФИО родителя — максимум ${FIO_MAX} символов`;
    if (!/^\+7\d{10}$/.test(form.phone)) return "Введите корректный номер телефона (+7 и 10 цифр)";
    if ((form.contact_method === "vk" || form.contact_method === "email") && !form.contact_email.trim())
      return form.contact_method === "vk" ? "Укажите VK ID или ссылку на профиль" : "Укажите email для связи";
    if (form.child_fio.trim().length < FIO_MIN) return `ФИО ребёнка — минимум ${FIO_MIN} символа`;
    if (form.child_fio.trim().length > FIO_MAX) return `ФИО ребёнка — максимум ${FIO_MAX} символов`;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    setLoading(true);
    try {
      const fn = isAuth
        ? consultationService.createAuth
        : consultationService.createGuest;
      await fn(form);
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        "Произошла ошибка. Попробуйте позже или позвоните нам напрямую."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="consultation-page">
      <Header />

      <section className="cr-hero">
        <div className="cr-hero__glow" aria-hidden="true" />
        <div className="page-container">
          <span className="d2-tag">Первичная консультация</span>
          <h1 className="cr-hero__title">Заявка на консультацию</h1>
          <p className="cr-hero__text">
            Заполните короткую форму, и администрация Центра свяжется с вами,
            чтобы уточнить запрос и подсказать дальнейшие шаги.
          </p>
        </div>
      </section>

      <main className="cr-body">
        <div className="page-container">
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
                {error && (
                  <div className="consultation-form__error">{error}</div>
                )}

                <div className="consultation-form__grid">
                  <label>
                    ФИО родителя *
                    <input
                      value={form.parent_fio}
                      onChange={set("parent_fio")}
                      required
                      disabled={isAuth}
                      placeholder="Иванова Мария Сергеевна"
                      minLength={FIO_MIN}
                      maxLength={FIO_MAX}
                    />
                  </label>

                  <label>
                    Телефон *
                    <input
                      value={phoneDisplay}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      onFocus={handlePhoneFocus}
                      required
                      placeholder="+7 (___) ___-__-__"
                    />
                  </label>

                  <label>
                    ФИО ребёнка *
                    <input
                      value={form.child_fio}
                      onChange={set("child_fio")}
                      required
                      placeholder="Иванов Иван Иванович"
                      minLength={FIO_MIN}
                      maxLength={FIO_MAX}
                    />
                  </label>

                  <label>
                    Возраст ребёнка *
                    <input
                      value={form.child_age}
                      onChange={set("child_age")}
                      required
                      placeholder="6 лет"
                    />
                  </label>

                  <label>
                    Удобный способ связи
                    <select
                      value={form.contact_method}
                      onChange={set("contact_method")}
                    >
                      {CONTACT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>

                  {form.contact_method === "vk" && (
                    <label>
                      ВКонтакте ID или ссылка на профиль *
                      <input
                        value={form.contact_email}
                        onChange={set("contact_email")}
                        required
                        placeholder="id123456789 или vk.com/username"
                      />
                    </label>
                  )}

                  {form.contact_method === "email" && (
                    <label>
                      Email для связи *
                      <input
                        type="email"
                        value={form.contact_email}
                        onChange={set("contact_email")}
                        required
                        disabled={isAuth}
                        placeholder="example@mail.ru"
                      />
                    </label>
                  )}
                </div>

                <label className="consultation-form__textarea">
                  Что вас беспокоит / какой запрос?
                  <textarea
                    value={form.request_text}
                    onChange={set("request_text")}
                    placeholder="Кратко опишите ситуацию, особенности ребёнка или интересующие направления"
                  />
                </label>

                <button type="submit" disabled={loading}>
                  {loading ? "Отправляем..." : "Отправить заявку"}
                </button>
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
