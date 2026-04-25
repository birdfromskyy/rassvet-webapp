import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Chip,
	CircularProgress,
	Alert,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	IconButton,
} from '@mui/material'
import {
	ArrowBack as BackIcon,
	ChevronLeft,
	ChevronRight,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

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
	return `${weekStart.toLocaleDateString('ru-RU', opts)} — ${weekEnd.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`
}

const getSlotBg = slot => {
	if (slot.slot_type === 'group') return 'rgba(76,175,80,0.10)'
	return 'rgba(33,150,243,0.10)'
}

const ChildSchedule = ({ user }) => {
	const navigate = useNavigate()
	const [children, setChildren] = useState([])
	const [selectedChildId, setSelectedChildId] = useState('')
	const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
	const [scheduleData, setScheduleData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [childrenLoading, setChildrenLoading] = useState(true)

	useEffect(() => {
		scheduleService.getMyChildren()
			.then(data => {
				setChildren(data)
				if (data.length === 1) setSelectedChildId(data[0].student_id)
			})
			.catch(() => toast.error('Ошибка загрузки данных'))
			.finally(() => setChildrenLoading(false))
	}, [])

	const weekStartISO = formatDateISO(weekStart)

	const loadSchedule = useCallback(async () => {
		if (!selectedChildId) return
		setLoading(true)
		setScheduleData(null)
		try {
			const data = await scheduleService.getChildSchedule(selectedChildId, weekStartISO)
			setScheduleData(data)
		} catch (e) {
			if (e.response?.status !== 404) {
				toast.error(e.response?.data?.error || 'Ошибка загрузки расписания')
			}
		} finally {
			setLoading(false)
		}
	}, [selectedChildId, weekStartISO])

	useEffect(() => {
		loadSchedule()
	}, [loadSchedule])

	const prevWeek = () =>
		setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })

	const nextWeek = () =>
		setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

	const selectedChild = children.find(c => c.student_id === selectedChildId)

	const slotsByDay = {}
	if (scheduleData?.slots) {
		for (const slot of scheduleData.slots) {
			if (!slotsByDay[slot.weekday]) slotsByDay[slot.weekday] = []
			slotsByDay[slot.weekday].push(slot)
		}
	}

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Typography variant='h4'>Расписание</Typography>
					<Button startIcon={<BackIcon />} onClick={() => navigate('/dashboard')}>
						На главную
					</Button>
				</Box>

				{childrenLoading ? (
					<Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
				) : children.length === 0 ? (
					<Alert severity='info'>
						К вашему аккаунту не привязаны ученики. Обратитесь к администратору.
					</Alert>
				) : (
					<>
						{children.length > 1 && (
							<FormControl fullWidth sx={{ mb: 3 }} size='small'>
								<InputLabel>Ученик</InputLabel>
								<Select
									value={selectedChildId}
									label='Ученик'
									onChange={e => { setSelectedChildId(e.target.value); setScheduleData(null) }}
								>
									{children.map(c => (
										<MenuItem key={c.student_id} value={c.student_id}>
											{c.student?.full_name || `Ученик #${c.student_id}`}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						)}

						{selectedChild && (
							<Typography variant='h6' sx={{ mb: 2, color: 'text.secondary' }}>
								{selectedChild.student?.full_name}
							</Typography>
						)}

						<Box display='flex' alignItems='center' justifyContent='center' gap={2} mb={3}>
							<IconButton onClick={prevWeek} size='large'><ChevronLeft /></IconButton>
							<Typography variant='h6' sx={{ minWidth: 320, textAlign: 'center', fontWeight: 500 }}>
								{formatWeekLabel(weekStart)}
							</Typography>
							<IconButton onClick={nextWeek} size='large'><ChevronRight /></IconButton>
						</Box>

						<Box display='flex' gap={2} mb={2} flexWrap='wrap'>
							<Box display='flex' alignItems='center' gap={0.5}>
								<Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(33,150,243,0.25)' }} />
								<Typography variant='caption'>Индивидуальное занятие</Typography>
							</Box>
							<Box display='flex' alignItems='center' gap={0.5}>
								<Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'rgba(76,175,80,0.25)' }} />
								<Typography variant='caption'>Групповое занятие</Typography>
							</Box>
						</Box>

						{loading && (
							<Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
						)}

						{!loading && !scheduleData && selectedChildId && (
							<Alert severity='info'>
								Опубликованное расписание на эту неделю не найдено.
							</Alert>
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
										<Table
											size='small'
											sx={{ tableLayout: 'fixed', width: '100%', minWidth: 500 }}
										>
											<colgroup>
												<col style={{ width: '130px' }} />
												<col />
												<col style={{ width: '200px' }} />
												<col style={{ width: '100px' }} />
											</colgroup>
											<TableHead>
												<TableRow>
													<TableCell>Время</TableCell>
													<TableCell>Предмет</TableCell>
													<TableCell>Преподаватель</TableCell>
													<TableCell>Кабинет</TableCell>
												</TableRow>
											</TableHead>
											<TableBody>
												{daySlots.map(slot => (
													<TableRow key={slot.id} sx={{ bgcolor: getSlotBg(slot) }}>
														<TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
															{slot.start_time}–{slot.end_time}
														</TableCell>
														<TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
															{slot.subject?.name || '—'}
															{slot.slot_type === 'group' && (
																<Chip
																	label='Группа'
																	size='small'
																	color='success'
																	sx={{ ml: 1 }}
																/>
															)}
														</TableCell>
														<TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
															{slot.teacher?.full_name || '—'}
														</TableCell>
														<TableCell sx={{ whiteSpace: 'nowrap' }}>
															{slot.room?.name || '—'}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								</Box>
							)
						})}

						{!loading && scheduleData && scheduleData.slots?.length === 0 && (
							<Alert severity='warning'>
								На этой неделе занятий не запланировано.
							</Alert>
						)}
					</>
				)}
			</Paper>
		</Container>
	)
}

export default ChildSchedule
