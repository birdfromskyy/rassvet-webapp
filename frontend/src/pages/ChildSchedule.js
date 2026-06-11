import React, { useState, useEffect, useCallback } from 'react'
import { CircularProgress } from '@mui/material'
import { toast } from 'react-toastify'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import scheduleService from '../services/scheduleService'
import './TeacherSchedule.scss'
import './ChildSchedule.scss'

const WEEKDAY_NAMES = {
  1: 'Понедельник', 2: 'Вторник', 3: 'Среда',
  4: 'Четверг', 5: 'Пятница', 6: 'Суббота', 7: 'Воскресенье',
}

const getMonday = date => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

const formatDateISO = date => date.toISOString().split('T')[0]

const formatWeekLabel = weekStart => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const opts = { day: 'numeric', month: 'long' }
  return `${weekStart.toLocaleDateString('ru-RU', opts)} — ${weekEnd.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`
}

const ChildSchedule = ({ user }) => {
  const [children, setChildren] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [scheduleData, setScheduleData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [childrenLoading, setChildrenLoading] = useState(true)

  useEffect(() => {
    scheduleService.getMyChildren()
      .then(data => {
        setChildren(data)
        setActiveIndex(0)
      })
      .catch(() => toast.error('Ошибка загрузки данных'))
      .finally(() => setChildrenLoading(false))
  }, [])

  const activeChild = children[activeIndex]
  const weekStartISO = formatDateISO(weekStart)

  const loadSchedule = useCallback(async () => {
    if (!activeChild) return
    setLoading(true)
    setScheduleData(null)
    try {
      const data = await scheduleService.getChildSchedule(activeChild.student_id, weekStartISO)
      setScheduleData(data)
    } catch (e) {
      if (e.response?.status !== 404) {
        toast.error(e.response?.data?.error || 'Ошибка загрузки расписания')
      }
    } finally {
      setLoading(false)
    }
  }, [activeChild, weekStartISO])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const slotsByDay = {}
  for (const slot of scheduleData?.slots || []) {
    if (!slotsByDay[slot.weekday]) slotsByDay[slot.weekday] = []
    slotsByDay[slot.weekday].push(slot)
  }

  const hasDays = scheduleData && Object.keys(slotsByDay).length > 0

  return (
    <div className="schedule-page">
      <Header />

      <main className="schedule">
        <div className="schedule__container page-container">

          <div className="schedule__hero">
            <span className="section-badge">Личный кабинет</span>
            <h1 className="schedule__title">Расписание ребёнка</h1>
            <p className="schedule__subtitle">Просмотр еженедельного расписания занятий</p>
          </div>

          {childrenLoading && (
            <div className="schedule__loading">
              <CircularProgress sx={{ color: '#074462' }} />
            </div>
          )}

          {!childrenLoading && children.length === 0 && (
            <div className="schedule__empty">
              <h2 className="schedule__day-title" style={{ margin: 0 }}>Ученики не привязаны</h2>
              <p>К вашему аккаунту не привязаны ученики. Обратитесь к администратору.</p>
            </div>
          )}

          {!childrenLoading && children.length > 0 && (
            <>
              {children.length > 1 && (
                <div className="schedule__child-selector">
                  <button
                    className="schedule__child-btn"
                    onClick={() => setActiveIndex(i => i === 0 ? children.length - 1 : i - 1)}
                    aria-label="Предыдущий ребёнок"
                  >‹</button>

                  <span className="schedule__child-name">
                    {activeChild?.student?.full_name}
                  </span>

                  <div className="schedule__child-dots">
                    {children.map((_, i) => (
                      <div
                        key={i}
                        className={`schedule__child-dot ${i === activeIndex ? 'schedule__child-dot--active' : ''}`}
                      />
                    ))}
                  </div>

                  <button
                    className="schedule__child-btn"
                    onClick={() => setActiveIndex(i => i === children.length - 1 ? 0 : i + 1)}
                    aria-label="Следующий ребёнок"
                  >›</button>
                </div>
              )}

              <div className="schedule__week-nav">
                <button onClick={prevWeek} aria-label="Предыдущая неделя">‹</button>
                <span className="schedule__week-label">{formatWeekLabel(weekStart)}</span>
                <button onClick={nextWeek} aria-label="Следующая неделя">›</button>
              </div>

              <div className="schedule__legend">
                <div className="schedule__legend-item">
                  <div className="schedule__legend-dot" style={{ background: 'rgba(7,68,98,0.15)' }} />
                  Индивидуальное
                </div>
                <div className="schedule__legend-item">
                  <div className="schedule__legend-dot" style={{ background: 'rgba(76,175,80,0.25)' }} />
                  Групповое
                </div>
              </div>

              {loading && (
                <div className="schedule__loading">
                  <CircularProgress sx={{ color: '#074462' }} />
                </div>
              )}

              {!loading && !scheduleData && (
                <div className="schedule__empty">
                  <h2 className="schedule__day-title" style={{ margin: 0 }}>Расписание не найдено</h2>
                  <p>На выбранную неделю опубликованного расписания нет</p>
                </div>
              )}

              {!loading && scheduleData && scheduleData.slots?.length === 0 && (
                <div className="schedule__empty">
                  <h2 className="schedule__day-title" style={{ margin: 0 }}>Занятий нет</h2>
                  <p>На этой неделе занятий не запланировано</p>
                </div>
              )}

              {!loading && hasDays && Object.keys(WEEKDAY_NAMES).map(dayStr => {
                const day = Number(dayStr)
                const daySlots = slotsByDay[day] || []
                if (!daySlots.length) return null
                return (
                  <div key={day} className="schedule__day">
                    <h2 className="schedule__day-title">{WEEKDAY_NAMES[day]}</h2>
                    <div className="schedule__slots">
                      {daySlots.map(slot => (
                        <div
                          key={slot.id}
                          className={`schedule__slot ${slot.slot_type === 'group' ? 'schedule__slot--group' : 'schedule__slot--individual'}`}
                        >
                          <div>
                            <div className="schedule__slot-time">{slot.start_time}–{slot.end_time}</div>
                            <span className={`schedule__slot-label ${slot.slot_type === 'group' ? 'schedule__slot-label--group' : ''}`}>
                              {slot.slot_type === 'group' ? 'Групповое' : 'Индивидуальное'}
                            </span>
                          </div>
                          <div className="schedule__slot-cell">
                            <small>Предмет</small>
                            {slot.subject?.name || slot.group_lesson?.name || '—'}
                          </div>
                          <div className="schedule__slot-cell">
                            <small>Преподаватель</small>
                            {slot.teacher?.full_name || '—'}
                          </div>
                          <div className="schedule__slot-cell">
                            <small>Кабинет</small>
                            {slot.room_name || slot.room?.name || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}

        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ChildSchedule
