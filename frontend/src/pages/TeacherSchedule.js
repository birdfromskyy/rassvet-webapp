import React, { useEffect, useMemo, useState } from 'react'
import { Autocomplete, CircularProgress, TextField } from '@mui/material'
import { toast } from 'react-toastify'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import scheduleService from '../services/scheduleService'
import useBrandFont from '../hooks/useBrandFont'
import './TeacherSchedule.scss'

const ALL_TEACHERS = { id: '', full_name: 'Все преподаватели' }
const ALL_STUDENTS = { id: '', full_name: 'Все ученики' }
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

const formatDateISO = date => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatWeekLabel = weekStart => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const opts = { day: 'numeric', month: 'long' }
  return `${weekStart.toLocaleDateString('ru-RU', opts)} — ${weekEnd.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`
}

const getDayDate = (weekStart, weekday) => {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + weekday - 1)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

const getSlotSubject = slot => slot.subject?.name || slot.group_lesson?.name || '—'
const getSlotStudent = slot => {
  if (slot.slot_type !== 'group') return slot.student?.full_name || '—'
  const excluded = new Set((slot.exclusions || []).map(ex => ex.student_id))
  return (slot.group_lesson?.enrollments || [])
    .filter(enr => !excluded.has(enr.student_id))
    .map(enr => enr.student?.full_name)
    .filter(Boolean)
    .join(', ') || slot.group_lesson?.name || '—'
}

const TeacherSchedule = ({ user }) => {
  useBrandFont()
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [teacher, setTeacher] = useState(ALL_TEACHERS)
  const [student, setStudent] = useState(ALL_STUDENTS)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [scheduleData, setScheduleData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const teacherIdFromUrl = Number(params.get('teacherId')) || 0
    const studentIdFromUrl = Number(params.get('studentId')) || 0
    scheduleService.getTeacherScheduleOptions()
      .then(data => {
        const loadedTeachers = data.teachers || []
        const loadedStudents = data.students || []
        setTeachers(loadedTeachers)
        setStudents(loadedStudents)
        // URL param > user's linked teacher (only when not filtering by student)
        const resolvedTeacherId = teacherIdFromUrl || (studentIdFromUrl ? 0 : (user?.teacher_id || 0))
        if (resolvedTeacherId) {
          const t = loadedTeachers.find(t => t.id === resolvedTeacherId)
          if (t) {
            setTeacher(t)
          } else if (resolvedTeacherId === user?.teacher_id) {
            // Own teacher record is temporarily inactive (e.g. on leave) — not in the
            // active-only options list, but we still know who "you" are from the
            // logged-in user, so build a usable filter value instead of silently
            // falling back to "all teachers" (which would show everyone's schedule).
            const ownName = [user?.last_name, user?.first_name, user?.middle_name].filter(Boolean).join(' ')
            setTeacher({ id: resolvedTeacherId, full_name: ownName || 'Вы' })
          }
        }
        if (studentIdFromUrl) {
          const s = loadedStudents.find(s => s.id === studentIdFromUrl)
          if (s) setStudent(s)
        }
      })
      .catch(() => toast.error('Ошибка загрузки фильтров расписания'))
      .finally(() => setOptionsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optionsLoading) return
    let cancelled = false
    setLoading(true)
    setScheduleData(null)
    scheduleService.getTeacherPublishedSchedule(formatDateISO(weekStart), {
      teacher_id: teacher?.id || '',
      student_id: student?.id || '',
    })
      .then(data => { if (!cancelled) setScheduleData(data) })
      .catch(e => {
        if (!cancelled && e.response?.status !== 404) {
          toast.error(e.response?.data?.error || 'Ошибка загрузки расписания')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [weekStart, teacher, student, optionsLoading])

  const slotsByDay = useMemo(() => {
    const grouped = {}
    for (const slot of scheduleData?.slots || []) {
      if (!grouped[slot.weekday]) grouped[slot.weekday] = []
      grouped[slot.weekday].push(slot)
    }
    return grouped
  }, [scheduleData])

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const hasDays = scheduleData && Object.keys(slotsByDay).length > 0

  return (
    <div className="schedule-page">
      <Header />

      <main className="schedule">
        <div className="schedule__container container">

          <div className="schedule__hero">
            <span className="section-badge">Личный кабинет</span>
            <h1 className="schedule__title">Расписание занятий</h1>
            <p className="schedule__subtitle">Просмотр еженедельного расписания по преподавателям и ученикам</p>
          </div>

          <div className="schedule__filters">
            <Autocomplete
              options={[ALL_TEACHERS, ...teachers]}
              value={teacher}
              getOptionLabel={option => option?.full_name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => setTeacher(value || ALL_TEACHERS)}
              renderInput={params => (
                <TextField {...params} label="Преподаватель" size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', background: '#fff' } }}
                />
              )}
            />
            <Autocomplete
              options={[ALL_STUDENTS, ...students]}
              value={student}
              getOptionLabel={option => option?.full_name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => setStudent(value || ALL_STUDENTS)}
              renderInput={params => (
                <TextField {...params} label="Ученик" size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', background: '#fff' } }}
                />
              )}
            />
          </div>

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

          {(loading || optionsLoading) && (
            <div className="schedule__loading">
              <CircularProgress sx={{ color: '#074462' }} />
            </div>
          )}

          {!loading && !optionsLoading && !scheduleData && (
            <div className="schedule__empty">
              <h2 className="schedule__day-title" style={{ margin: 0 }}>Расписание не найдено</h2>
              <p>На выбранную неделю опубликованного расписания нет</p>
            </div>
          )}

          {!loading && scheduleData && scheduleData.slots?.length === 0 && (
            <div className="schedule__empty">
              <h2 className="schedule__day-title" style={{ margin: 0 }}>Занятий нет</h2>
              <p>На этой неделе занятий по выбранным фильтрам не запланировано</p>
            </div>
          )}

          {!loading && hasDays && Object.keys(WEEKDAY_NAMES).map(dayStr => {
            const day = Number(dayStr)
            const daySlots = slotsByDay[day] || []
            if (!daySlots.length) return null
            return (
              <div key={day} className="schedule__day">
                <h2 className="schedule__day-title">{WEEKDAY_NAMES[day]}<span className="schedule__day-date">, {getDayDate(weekStart, day)}</span></h2>
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
                        {getSlotSubject(slot)}
                      </div>
                      <div className="schedule__slot-cell">
                        <small>Ученик / группа</small>
                        {getSlotStudent(slot)}
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

        </div>
      </main>

      <Footer />
    </div>
  )
}

export default TeacherSchedule
