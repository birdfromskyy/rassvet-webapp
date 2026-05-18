import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import authService from "../../services/authService";

import "./Register.scss";

const Register = () => {
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

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    } else if (formData.password.length < 6) {
      newErrors.password = "Пароль должен быть не менее 6 символов";
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

      await authService.register(dataToSend);

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
      <div className="container">
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
                  />
                </div>

                <div className="register-form__field">
                  <label>Пароль *</label>

                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Введите пароль"
                  />

                  {errors.password && (
                    <span className="register-form__error">
                      {errors.password}
                    </span>
                  )}
                </div>

                <div className="register-form__field">
                  <label>Подтвердите пароль *</label>

                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Повторите пароль"
                  />

                  {errors.confirmPassword && (
                    <span className="register-form__error">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
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