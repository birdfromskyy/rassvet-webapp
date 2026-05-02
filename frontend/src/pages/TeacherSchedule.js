import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Alert,
	Autocomplete,
	Box,
	Button,
	CircularProgress,
	Container,
	IconButton,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material'
import { ArrowBack as BackIcon, ChevronLeft, ChevronRight } from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const ALL_TEACHERS = { id: '', full_name: 'Все преподаватели' }
const ALL_STUDENTS = { id: '', full_name: 'Все ученики' }
const WEEKDAY_NAMES = {
	1: 'Понедельник',
	2: 'Вторник',
	3: 'Среда',
	4: 'Четверг',
	5: 'Пятница',
	6: 'Суббота',
	7: 'Воскресенье',
}

const getMonday = date => {
	const d = new Date(date)
	const day = d.getDay()
	const diff = day === 0 ? -6 : 1 - day
	d.setDate(d.getDate() + diff)
	d.setHours(0, 0, 0, 0)
	return d
}

const formatDateISO = date => date.toISOString().split('T')[0]

const formatWeekLabel = weekStart => {
	const weekEnd = new Date(weekStart)
	weekEnd.setDate(weekEnd.getDate() + 5)
	const opts = { day: 'numeric', month: 'long' }
	return `${weekStart.toLocaleDateString('ru-RU', opts)} - ${weekEnd.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`
}

const getSlotSubject = slot => slot.subject?.name || slot.group_lesson?.name || '-'
const getSlotStudent = slot => {
	if (slot.slot_type !== 'group') return slot.student?.full_name || '-'
	const excluded = new Set((slot.exclusions || []).map(ex => ex.student_id))
	return (slot.group_lesson?.enrollments || [])
		.filter(enr => !excluded.has(enr.student_id))
		.map(enr => enr.student?.full_name)
		.filter(Boolean)
		.join(', ') || slot.group_lesson?.name || '-'
}

const TeacherSchedule = ({ user }) => {
	const navigate = useNavigate()
	const [teachers, setTeachers] = useState([])
	const [students, setStudents] = useState([])
	const [teacher, setTeacher] = useState(ALL_TEACHERS)
	const [student, setStudent] = useState(ALL_STUDENTS)
	const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
	const [scheduleData, setScheduleData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [optionsLoading, setOptionsLoading] = useState(true)

	useEffect(() => {
		scheduleService.getTeacherScheduleOptions()
			.then(data => {
				const loadedTeachers = data.teachers || []
				setTeachers(loadedTeachers)
				setStudents(data.students || [])

				const fullName = [user?.last_name, user?.first_name, user?.middle_name].filter(Boolean).join(' ').toLowerCase()
				const ownTeacher = loadedTeachers.find(t => t.full_name?.toLowerCase() === fullName)
				if (ownTeacher) setTeacher(ownTeacher)
			})
			.catch(() => toast.error('Ошибка загрузки фильтров расписания'))
			.finally(() => setOptionsLoading(false))
	}, [user])

	const weekStartISO = formatDateISO(weekStart)

	const loadSchedule = useCallback(async () => {
		setLoading(true)
		setScheduleData(null)
		try {
			const data = await scheduleService.getTeacherPublishedSchedule(weekStartISO, {
				teacher_id: teacher?.id || '',
				student_id: student?.id || '',
			})
			setScheduleData(data)
		} catch (e) {
			if (e.response?.status !== 404) {
				toast.error(e.response?.data?.error || 'Ошибка загрузки расписания')
			}
		} finally {
			setLoading(false)
		}
	}, [weekStartISO, teacher, student])

	useEffect(() => {
		if (!optionsLoading) loadSchedule()
	}, [loadSchedule, optionsLoading])

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

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Typography variant='h4'>Расписание</Typography>
					<Button startIcon={<BackIcon />} onClick={() => navigate('/dashboard')}>
						На главную
					</Button>
				</Box>

				<Box display='grid' gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mb={3}>
					<Autocomplete
						options={[ALL_TEACHERS, ...teachers]}
						value={teacher}
						getOptionLabel={option => option?.full_name || ''}
						onChange={(_, value) => setTeacher(value || ALL_TEACHERS)}
						renderInput={params => <TextField {...params} label='Преподаватель' size='small' />}
					/>
					<Autocomplete
						options={[ALL_STUDENTS, ...students]}
						value={student}
						getOptionLabel={option => option?.full_name || ''}
						onChange={(_, value) => setStudent(value || ALL_STUDENTS)}
						renderInput={params => <TextField {...params} label='Ученик' size='small' />}
					/>
				</Box>

				<Box display='flex' alignItems='center' justifyContent='center' gap={2} mb={3}>
					<IconButton onClick={prevWeek} size='large'><ChevronLeft /></IconButton>
					<Typography variant='h6' sx={{ minWidth: 320, textAlign: 'center', fontWeight: 500 }}>
						{formatWeekLabel(weekStart)}
					</Typography>
					<IconButton onClick={nextWeek} size='large'><ChevronRight /></IconButton>
				</Box>

				{(loading || optionsLoading) && <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>}

				{!loading && !optionsLoading && !scheduleData && (
					<Alert severity='info'>Опубликованное расписание на эту неделю не найдено.</Alert>
				)}

				{!loading && scheduleData && Object.keys(WEEKDAY_NAMES).map(dayStr => {
					const day = Number(dayStr)
					const daySlots = slotsByDay[day] || []
					if (!daySlots.length) return null
					return (
						<Box key={day} mb={3}>
							<Typography variant='h6' sx={{ mb: 1, color: 'primary.main', fontWeight: 600 }}>
								{WEEKDAY_NAMES[day]}
							</Typography>
							<TableContainer>
								<Table size='small' sx={{ tableLayout: 'fixed', width: '100%', minWidth: 760 }}>
									<TableHead>
										<TableRow>
											<TableCell>Время</TableCell>
											<TableCell>Тип</TableCell>
											<TableCell>Ученик / группа</TableCell>
											<TableCell>Предмет / название</TableCell>
											<TableCell>Преподаватель</TableCell>
											<TableCell>Кабинет</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{daySlots.map(slot => (
											<TableRow key={slot.id}>
												<TableCell>{slot.start_time}-{slot.end_time}</TableCell>
												<TableCell>{slot.slot_type === 'group' ? 'Групповое' : 'Индивидуальное'}</TableCell>
												<TableCell>{getSlotStudent(slot)}</TableCell>
												<TableCell>{getSlotSubject(slot)}</TableCell>
												<TableCell>{slot.teacher?.full_name || '-'}</TableCell>
												<TableCell>{slot.room_name || slot.room?.name || '-'}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						</Box>
					)
				})}

				{!loading && scheduleData && scheduleData.slots?.length === 0 && (
					<Alert severity='warning'>На этой неделе занятий по выбранным фильтрам нет.</Alert>
				)}
			</Paper>
		</Container>
	)
}

export default TeacherSchedule
