import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import authService from "../../services/authService";

import "./Login.scss";
import useBrandFont from "../../hooks/useBrandFont";

const Login = ({ onLogin }) => {
  useBrandFont();
  useEffect(() => {
    document.title = "Вход";
  }, []);

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await authService.login(formData);

      onLogin(response.user);

      toast.success("Вход выполнен успешно!");
      navigate("/dashboard");
    } catch (error) {
      if (error.response?.data?.error?.includes("не подтверждён")) {
        toast.error("Email не подтверждён. Проверьте почту.");
        navigate("/verify-email", { state: { email: formData.email } });
      } else {
        setError(error.response?.data?.error || "Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="page-container">
        <div className="login-page__wrapper">
          <div className="login-card">
            <div className="login-card__top">
              <h2>Вход в систему</h2>

              <p>
                Введите email и пароль, чтобы перейти в личный кабинет.
              </p>
            </div>

            {error && <div className="login-form__alert">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form__grid">
                <div className="login-form__field">
                  <label>Email *</label>

                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@mail.ru"
                    required
                    maxLength={254}
                    autoFocus
                  />
                </div>

                <div className="login-form__field">
                  <label>Пароль *</label>

                  <div className="login-form__input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Введите пароль"
                      required
                      maxLength={128}
                    />
                    <button
                      type="button"
                      className="login-form__eye"
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
                </div>
              </div>

              <button
                type="submit"
                className="login-form__button"
                disabled={loading}
              >
                {loading ? "Вход..." : "Войти"}
              </button>

              <div className="login-form__bottom">
                <Link to="/forgot-password">Забыли пароль?</Link>

                <div>
                  <span>Нет аккаунта?</span>
                  <Link to="/register">Зарегистрироваться</Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;