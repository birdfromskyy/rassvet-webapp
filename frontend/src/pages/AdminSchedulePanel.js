import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	MenuBook as SubjectIcon,
	Person as TeacherIcon,
	ChildCare as StudentIcon,
	MeetingRoom as RoomIcon,
	Assignment as AssignmentIcon,
	CalendarMonth as ScheduleIcon,
	Groups as GroupIcon,
	Payments as TariffsIcon,
	ArrowBack as BackIcon,
	Assessment as ReportsIcon,
} from '@mui/icons-material'

import useBrandFont from '../hooks/useBrandFont'
import './AdminCMSPanel/AdminCMSPanel.scss'

const MODULES = [
	{
		title: 'Предметы',
		description: 'Управление предметами и дисциплинами центра.',
		icon: SubjectIcon,
		path: '/admin/schedule/subjects',
	},
	{
		title: 'Сотрудники',
		description: 'Сотрудники, их предметы, кабинеты и рабочее время.',
		icon: TeacherIcon,
		path: '/admin/schedule/teachers',
	},
	{
		title: 'Ученики',
		description: 'Ученики, их доступность и тип финансирования.',
		icon: StudentIcon,
		path: '/admin/schedule/students',
	},
	{
		title: 'Кабинеты',
		description: 'Кабинеты и доступные в них предметы.',
		icon: RoomIcon,
		path: '/admin/schedule/rooms',
	},
	{
		title: 'Назначения',
		description: 'Связки ученик — преподаватель — предмет.',
		icon: AssignmentIcon,
		path: '/admin/schedule/assignments',
	},
	{
		title: 'Групповые занятия',
		description: 'Группы учеников с общим преподавателем и предметом.',
		icon: GroupIcon,
		path: '/admin/schedule/group-lessons',
	},
	{
		title: 'Расписание',
		description: 'Генерация и управление расписанием на неделю.',
		icon: ScheduleIcon,
		path: '/admin/schedule/weekly',
	},
	{
		title: 'Тарифы на коммерческие услуги',
		description: 'Текущая стоимость услуг и правила расчёта сумм в отчётности по детям.',
		icon: TariffsIcon,
		path: '/admin/schedule/tariffs',
	},
	{
		title: 'Отчётность',
		description: 'Занятия по детям и преподавателям за выбранный период.',
		icon: ReportsIcon,
		path: '/admin/schedule/reports',
	},
]

const AdminSchedulePanel = () => {
	const navigate = useNavigate()
	const [search, setSearch] = useState('')
	useBrandFont()

	const filtered = MODULES.filter(m =>
		`${m.title} ${m.description}`.toLowerCase().includes(search.toLowerCase().trim())
	)

	return (
		<main className="admin-cms">
			<div className="admin-cms__container">

				<section className="admin-cms__hero">
					<div>
						<span className="admin-cms__badge">Расписание</span>
						<h1>Модуль расписания</h1>
						<p>
							Автоматическое формирование расписания занятий с учётом окон
							преподавателей, учеников, кабинетов и ограничений.
						</p>
					</div>
					<div className="admin-cms__actions">
						<button
							type="button"
							className="admin-cms__back"
							onClick={() => navigate('/dashboard')}
						>
							<BackIcon />
							На главную
						</button>
					</div>
				</section>

				<div className="admin-cms__search">
					<input
						type="text"
						placeholder="Найти раздел..."
						value={search}
						onChange={e => setSearch(e.target.value)}
					/>
				</div>

				<section className="admin-cms__grid">
					{filtered.map(m => {
						const Icon = m.icon
						return (
							<article className="admin-cms-card" key={m.path} onClick={() => navigate(m.path)} style={{ cursor: 'pointer' }}>
								<div className="admin-cms-card__icon">
									<Icon />
								</div>
								<div className="admin-cms-card__content">
									<h2>{m.title}</h2>
									<p>{m.description}</p>
								</div>
								<button type="button" onClick={e => { e.stopPropagation(); navigate(m.path) }}>
									Открыть
								</button>
							</article>
						)
					})}
				</section>

			</div>
		</main>
	)
}

export default AdminSchedulePanel
