import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import authService from "../../services/authService";

import "./Register.scss";
import useBrandFont from "../../hooks/useBrandFont";

const Register = () => {
  useBrandFont();
  useEffect(() => {
    document.title = "Регистрация";
  }, []);

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    middle_name: "",
  });

  const [consentGiven, setConsentGiven] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email обязателен";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email недействителен";
    }

    if (!formData.password) {
      newErrors.password = "Пароль обязателен";
    } else if (formData.password.length < 8) {
      newErrors.password = "Пароль должен быть не менее 8 символов";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = "Пароль должен содержать хотя бы одну заглавную букву";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Пароль должен содержать хотя бы одну цифру";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Пароли не совпадают";
    }

    if (!formData.first_name) {
      newErrors.first_name = "Имя обязательно";
    }

    if (!formData.last_name) {
      newErrors.last_name = "Фамилия обязательна";
    }

    if (!consentGiven) {
      newErrors.consent = "Необходимо согласие на обработку персональных данных";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validate();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...dataToSend } = formData;

      await authService.register({ ...dataToSend, consent_given: consentGiven });

      toast.success(
        "Регистрация успешна! Проверьте email для подтверждения."
      );

      navigate(
        `/verify-email?email=${encodeURIComponent(formData.email)}`
      );
    } catch (error) {
      if (error.response?.status === 409) {
        setErrors({
          email: "Пользователь с таким email уже существует",
        });
      } else {
        toast.error(
          error.response?.data?.error || "Ошибка регистрации"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="register-page">
      <div className="page-container">
        <div className="register-page__wrapper">

          <div className="register-card">
			
            <div className="register-card__top">
              <h2>Регистрация</h2>

              <p>
                Заполните данные для создания аккаунта
              </p>
            </div>

            <form onSubmit={handleSubmit} className="register-form">
              <div className="register-form__grid">
                <div className="register-form__field">
                  <label>Email *</label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@mail.ru"
                  />

                  {errors.email && (
                    <span className="register-form__error">
                      {errors.email}
                    </span>
                  )}
                </div>

                <div className="register-form__field">
                  <label>Имя *</label>

                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Введите имя"
                    maxLength={100}
                  />

                  {errors.first_name && (
                    <span className="register-form__error">
                      {errors.first_name}
                    </span>
                  )}
                </div>

                <div className="register-form__field">
                  <label>Фамилия *</label>

                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Введите фамилию"
                    maxLength={100}
                  />

                  {errors.last_name && (
                    <span className="register-form__error">
                      {errors.last_name}
                    </span>
                  )}
                </div>

                <div className="register-form__field">
                  <label>Отчество</label>

                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    placeholder="Введите отчество"
                    maxLength={100}
                  />
                </div>

                <div className="register-form__field">
                  <label>Пароль *</label>

                  <div className="register-form__input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Введите пароль"
                    />
                    <button
                      type="button"
                      className="register-form__eye"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>

                  {errors.password && (
                    <span className="register-form__error">
                      {errors.password}
                    </span>
                  )}
                </div>

                <div className="register-form__field">
                  <label>Подтвердите пароль *</label>

                  <div className="register-form__input-wrap">
                    <input
                      type={showConfirm ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Повторите пароль"
                    />
                    <button
                      type="button"
                      className="register-form__eye"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showConfirm ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>

                  {errors.confirmPassword && (
                    <span className="register-form__error">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>

              <div className="register-form__consent">
                <label className="register-form__consent-label">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => {
                      setConsentGiven(e.target.checked);
                      if (errors.consent) setErrors({ ...errors, consent: "" });
                    }}
                  />
                  <span>
                    Я даю согласие на обработку{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      персональных данных
                    </a>{" "}
                    в соответствии с Федеральным законом №&nbsp;152-ФЗ
                  </span>
                </label>
                {errors.consent && (
                  <span className="register-form__error">{errors.consent}</span>
                )}
              </div>

              <button
                type="submit"
                className="register-form__button"
                disabled={loading}
              >
                {loading
                  ? "Регистрация..."
                  : "Создать аккаунт"}
              </button>

              <div className="register-form__bottom">
                <span>Уже есть аккаунт?</span>

                <Link to="/login">Войти</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Register;