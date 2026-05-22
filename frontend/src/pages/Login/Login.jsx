import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import authService from "../../services/authService";

import "./Login.scss";

const Login = ({ onLogin }) => {
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

      onLogin(response.token, response.user);

      toast.success("Вход выполнен успешно!");
      navigate("/dashboard");
    } catch (error) {
      if (error.response?.data?.error === "Email not verified") {
        toast.error("Email не подтвержден. Проверьте почту.");
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
      <div className="container">
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
                    autoFocus
                  />
                </div>

                <div className="login-form__field">
                  <label>Пароль *</label>

                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Введите пароль"
                  />
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