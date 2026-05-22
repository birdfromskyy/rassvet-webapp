import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import authService from '../../services/authService'
import './Profile.scss'

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const Profile = ({ user, onUpdateUser, onLogout }) => {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'РАСсвет | Профиль'
  }, [])

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        middle_name: user.middle_name || '',
        email: user.email || '',
        password: '',
        confirmPassword: '',
      })
    }
  }, [user])

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value })

    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' })
    }
  }

  const validate = () => {
    const newErrors = {}

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email недействителен'
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = 'Пароль должен быть не менее 6 символов'
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Пароли не совпадают'
      }
    }

    return newErrors
  }

  const handleSubmit = async e => {
    e.preventDefault()

    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const dataToSend = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name,
      }

      if (formData.email !== user?.email) dataToSend.email = formData.email
      if (formData.password) dataToSend.password = formData.password

      const response = await authService.updateProfile(dataToSend)

      if (response.emailChanged) {
        toast.info('Email изменен. Требуется повторная верификация')
        onLogout()

        setTimeout(() => {
          navigate(`/verify-email?email=${encodeURIComponent(response.email)}`)
        }, 1500)

        return
      }

      onUpdateUser(response.user)
      toast.success('Профиль обновлен')
    } catch (error) {
      if (error.response?.status === 409) {
        setErrors({ email: 'Email уже используется' })
      } else {
        toast.error(error.response?.data?.error || 'Ошибка обновления профиля')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
	<>
	<Header />
    <main className="profile-page">
      <section className="profile">
        <div className="profile__container container">
          <div className="profile__header">
            <div>
              <span className="section-badge">Личный кабинет</span>
              <h1 className="profile__title">Профиль пользователя</h1>
              <p className="profile__subtitle">
                Здесь можно изменить личные данные, email и пароль.
              </p>
            </div>
          </div>

          <form className="profile__card" onSubmit={handleSubmit}>
            <div className="profile__section">
              <h2>Личные данные</h2>

              <div className="profile__grid profile__grid--three">
                <label className="profile__field">
                  <span>Фамилия</span>
                  <input
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </label>

                <label className="profile__field">
                  <span>Имя</span>
                  <input
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </label>

                <label className="profile__field">
                  <span>Отчество</span>
                  <input
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                  />
                </label>
              </div>
            </div>

            <div className="profile__section">
              <h2>Учетные данные</h2>

              <div className="profile__grid">
                <label className="profile__field">
                  <span>Email</span>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? 'is-error' : ''}
                  />
                  <small>{errors.email || 'При смене email потребуется повторная верификация'}</small>
                </label>
              </div>

              <div className="profile__notice">
                Оставьте поля паролей пустыми, если не хотите его менять.
              </div>

              <div className="profile__grid profile__grid--two">
                <label className="profile__field">
                  <span>Новый пароль</span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'is-error' : ''}
                  />
                  {errors.password && <small>{errors.password}</small>}
                </label>

                <label className="profile__field">
                  <span>Подтвердите пароль</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? 'is-error' : ''}
                  />
                  {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
                </label>
              </div>
            </div>

            <div className="profile__actions">
              <button type="submit" className="profile__save" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
	<Footer />
	</>
  )
}

export default Profile