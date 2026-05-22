import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header/Header'
import Footer from '../../components/Footer/Footer'
import NewsSection from '../../components/NewsSection/NewsSection'

import authService from '../../services/authService'
import scheduleService from '../../services/scheduleService'

import { toast } from 'react-toastify'

import './Dashboard.scss'

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate()

  const [hasChildren, setHasChildren] = useState(false)

  useEffect(() => {
    document.title = 'РАСсвет | Личный кабинет'
  }, [])

  useEffect(() => {
    scheduleService
      .getMyChildren()
      .then(data => setHasChildren(data.length > 0))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await authService.logout()

      onLogout()

      toast.success('Вы успешно вышли из системы')

      navigate('/login')
    } catch (error) {
      console.error(error)

      onLogout()
      navigate('/login')
    }
  }

  const cards = [
    {
      title: 'Новости',
      text: 'Читайте последние новости и обновления центра.',
      button: 'Все новости',
      path: '/news',
      show: true,
    },

    {
      title: 'Отзывы',
      text: 'Просмотрите отзывы пользователей или оставьте свой.',
      button: 'Перейти',
      path: '/reviews',
      show: true,
    },

    {
      title: 'Расписание',
      text:
        user?.role === 'teacher'
          ? 'Просмотр расписания преподавателей и учеников.'
          : 'Расписание занятий вашего ребёнка.',
      button: 'Открыть',
      path: '/my-schedule',
      show: hasChildren || user?.role === 'teacher',
    },

    {
      title: 'Администрирование',
      text: 'Управление контентом и модерация отзывов.',
      button: 'Отзывы',
      path: '/admin/reviews',
      show: user?.role === 'admin',
    },

    {
      title: 'Составление расписания',
      text: 'Автоматическое формирование расписания занятий.',
      button: 'Открыть',
      path: '/admin/schedule',
      show: user?.role === 'admin',
    },

    {
      title: 'Управление сайтом',
      text: 'Редактирование публичных страниц и контента.',
      button: 'CMS',
      path: '/admin/cms',
      show: user?.role === 'admin',
    },
  ]

  return (
    <div className="page page--dashboard">
      <Header />

      <main className="dashboard">
        <div className="dashboard__container container">
          <section className="dashboard__hero">
            <div>
              <span className="section-badge">
                Личный кабинет
              </span>

              <h1 className="dashboard__title">
                Здавствуйте,&nbsp;
                {user?.first_name}!
              </h1>

              <p className="dashboard__subtitle">
                Здесь вы можете просматривать новости,
                расписание, отзывы и управлять профилем.
              </p>
            </div>

            <div className="dashboard__actions">
              <button onClick={() => navigate('/profile')}>
                Профиль
              </button>

              <button
                className="dashboard__logout"
                onClick={handleLogout}
              >
                Выйти
              </button>
            </div>
          </section>

          <NewsSection limit={3} />

          <section className="dashboard__cards">
            {cards
              .filter(card => card.show)
              .map(card => (
                <article key={card.title} className="dashboard-card">
                  <h2>{card.title}</h2>

                  <p>{card.text}</p>

                  <button onClick={() => navigate(card.path)}>
                    {card.button}
                  </button>
                </article>
              ))}
          </section>

          <section className="dashboard-profile">
            <div className="dashboard-profile__top">
              <span className="section-badge">
                Профиль
              </span>

              <h2>Информация о пользователе</h2>
            </div>

            <div className="dashboard-profile__grid">
              <div className="dashboard-profile__item">
                <span>Имя</span>

                <strong>
                  {user?.first_name} {user?.middle_name} {user?.last_name}
                </strong>
              </div>

              <div className="dashboard-profile__item">
                <span>Email</span>

                <strong>{user?.email}</strong>
              </div>

              <div className="dashboard-profile__item">
                <span>Роль</span>

                <strong>
                  {user?.role === 'admin'
                    ? 'Администратор'
                    : user?.role === 'teacher'
                    ? 'Преподаватель'
                    : 'Пользователь'}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default Dashboard