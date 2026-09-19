import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import authService from "../../services/authService";

import "./ForgotPassword.scss";
import useBrandFont from "../../hooks/useBrandFont";

const steps = ["Email", "Код", "Готово"];

const ForgotPassword = () => {
  useBrandFont();
  useEffect(() => {
    document.title = "Восстановление пароля";
  }, []);

  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await authService.forgotPassword(email);

      toast.success("Код отправлен на email");
      setActiveStep(1);
    } catch (error) {
      setError(error.response?.data?.error || "Ошибка отправки кода");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await authService.resetPassword(email, code);

      toast.success("Новый пароль отправлен на email!");
      setActiveStep(2);

      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      if (error.response?.status === 429) {
        setError("Превышено количество попыток. Запросите новый код.");
      } else {
        setError(error.response?.data?.error || "Неверный код");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="forgot-page">
      <div className="page-container">
        <div className="forgot-page__wrapper">
          <div className="forgot-card">
            <div className="forgot-card__top">
              <h2>Восстановление пароля</h2>

              <p>
                Введите email, получите код подтверждения и восстановите доступ
                к аккаунту.
              </p>
            </div>

            <div className="forgot-steps">
              {steps.map((step, index) => (
                <div
                  className={`forgot-step ${
                    activeStep >= index ? "is-active" : ""
                  }`}
                  key={step}
                >
                  <div className="forgot-step__number">{index + 1}</div>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {error && <div className="forgot-form__alert">{error}</div>}

            {activeStep === 0 && (
              <form onSubmit={handleSendCode} className="forgot-form">
                <div className="forgot-form__field">
                  <label>Email *</label>

                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@mail.ru"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="forgot-form__button"
                  disabled={loading}
                >
                  {loading ? "Отправка..." : "Отправить код"}
                </button>
              </form>
            )}

            {activeStep === 1 && (
              <form onSubmit={handleResetPassword} className="forgot-form">
                <div className="forgot-form__field">
                  <label>Код из письма *</label>

                  <input
                    type="text"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    minLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                  />

                  <small>У вас есть 5 попыток ввода кода</small>
                </div>

                <button
                  type="submit"
                  className="forgot-form__button"
                  disabled={loading}
                >
                  {loading ? "Проверка..." : "Сбросить пароль"}
                </button>
              </form>
            )}

            {activeStep === 2 && (
              <div className="forgot-form__success">
                Новый пароль отправлен на ваш email. Вы будете перенаправлены на
                страницу входа...
              </div>
            )}

            <div className="forgot-form__bottom">
              <Link to="/login">Вернуться к входу</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;