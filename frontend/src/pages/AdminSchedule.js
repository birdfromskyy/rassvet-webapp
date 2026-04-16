import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Chip,
	CircularProgress,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Grid,
	Alert,
} from '@mui/material'
import {
	ArrowBack as BackIcon,
	ChevronLeft,
	ChevronRight,
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	CheckCircle as ApproveIcon,
	Refresh as ResetIcon,
	AutoAwesome as GenerateIcon,
	ExpandMore as ExpandIcon,
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
}

const STATUS_COLORS = {
	draft: 'warning',
	approved: 'success',
	archived: 'default',
}
const STATUS_LABELS = {
	draft: 'Черновик',
	approved: 'Утверждено',
	archived: 'Архив',
}
const SLOT_STATUS_COLORS = {
	scheduled: 'success',
	moved: 'warning',
	cancelled: 'error',
}
const SLOT_STATUS_LABELS = {
	scheduled: 'Запланировано',
	moved: 'Перенесено',
	cancelled: 'Отменено',
}

const EMPTY_SLOT_FORM = {
	assignment_id: '',
	room_id: '',
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
}

const EMPTY_EDIT_FORM = {
	weekday: 1,
	start_time: '09:00',
	end_time: '09:50',
	room_id: '',
	status: 'scheduled',
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

const AdminSchedule = () => {
	const navigate = useNavigate()
	const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
	const [scheduleData, setScheduleData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [generating, setGenerating] = useState(false)

	// Reference data for dialogs and filters
	const [assignments, setAssignments] = useState([])
	const [rooms, setRooms] = useState([])
	const [students, setStudents] = useState([])
	const [teachers, setTeachers] = useState([])
	const [refLoaded, setRefLoaded] = useState(false)

	// Slot filters
	const [filterStudentId, setFilterStudentId] = useState('')
	const [filterTeacherId, setFilterTeacherId] = useState('')

	// Create slot dialog
	const [createDialog, setCreateDialog] = useState(false)
	const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)

	// Edit slot dialog
	const [editDialog, setEditDialog] = useState({ open: false, slot: null })
	const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)

	const weekStartISO = formatDateISO(weekStart)

	const loadSchedule = useCallback(async () => {
		setLoading(true)
		try {
			const data = await scheduleService.getScheduleByWeek(weekStartISO)
			setScheduleData(data)
		} catch (e) {
			if (e.response?.status === 404) {
				setScheduleData(null)
			} else {
				toast.error('Ошибка загрузки расписания')
			}
		} finally {
			setLoading(false)
		}
	}, [weekStartISO])

	useEffect(() => {
		loadSchedule()
	}, [loadSchedule])

	// Load reference data once
	useEffect(() => {
		if (refLoaded) return
		Promise.all([
			scheduleService.getAssignments({ status: 'active' }),
			scheduleService.getRooms(),
			scheduleService.getStudents(),
			scheduleService.getTeachers(),
		])
			.then(([aData, rData, sData, tData]) => {
				setAssignments(aData)
				setRooms(rData.filter(r => r.is_active))
				setStudents(sData)
				setTeachers(tData)
				setRefLoaded(true)
			})
			.catch(() => toast.error('Ошибка загрузки справочников'))
	}, [refLoaded])

	const prevWeek = () =>
		setWeekStart(d => {
			const n = new Date(d)
			n.setDate(n.getDate() - 7)
			return n
		})

	const nextWeek = () =>
		setWeekStart(d => {
			const n = new Date(d)
			n.setDate(n.getDate() + 7)
			return n
		})

	const generate = async () => {
		if (
			!window.confirm(
				`Сгенерировать расписание на неделю ${formatWeekLabel(weekStart)}?`,
			)
		)
			return
		setGenerating(true)
		try {
			const data = await scheduleService.generateSchedule(weekStartISO)
			setScheduleData(data)
			toast.success('Расписание сгенерировано')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка генерации')
		} finally {
			setGenerating(false)
		}
	}

	const approve = async () => {
		if (!window.confirm('Утвердить расписание?')) return
		try {
			await scheduleService.approveSchedule(scheduleData.schedule.id)
			toast.success('Расписание утверждено')
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const resetAuto = async () => {
		if (
			!window.confirm(
				'Удалить авто-слоты и перегенерировать? Ручные слоты сохранятся.',
			)
		)
			return
		setGenerating(true)
		try {
			const data = await scheduleService.resetAutoSchedule(
				scheduleData.schedule.id,
			)
			setScheduleData(data)
			toast.success('Авто-слоты сброшены и пересчитаны')
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		} finally {
			setGenerating(false)
		}
	}

	const openCreateSlot = () => {
		setSlotForm(EMPTY_SLOT_FORM)
		setCreateDialog(true)
	}

	const createSlot = async () => {
		if (!slotForm.assignment_id || !slotForm.room_id) {
			toast.error('Выберите назначение и кабинет')
			return
		}
		const assignment = assignments.find(a => a.id === slotForm.assignment_id)
		if (!assignment) {
			toast.error('Назначение не найдено')
			return
		}
		try {
			await scheduleService.createSlot(scheduleData.schedule.id, {
				assignment_id: slotForm.assignment_id,
				student_id: assignment.student_id,
				teacher_id: assignment.teacher_id,
				subject_id: assignment.subject_id,
				room_id: slotForm.room_id,
				weekday: slotForm.weekday,
				start_time: slotForm.start_time,
				end_time: slotForm.end_time,
			})
			toast.success('Слот добавлен')
			setCreateDialog(false)
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка создания слота')
		}
	}

	const openEditSlot = slot => {
		setEditForm({
			weekday: slot.weekday,
			start_time: slot.start_time,
			end_time: slot.end_time,
			room_id: slot.room_id,
			status: slot.status,
		})
		setEditDialog({ open: true, slot })
	}

	const saveEditSlot = async () => {
		try {
			await scheduleService.updateSlot(
				scheduleData.schedule.id,
				editDialog.slot.id,
				editForm,
			)
			toast.success('Слот обновлён')
			setEditDialog({ open: false, slot: null })
			loadSchedule()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка обновления')
		}
	}

	const deleteSlot = async slotId => {
		if (!window.confirm('Удалить слот?')) return
		try {
			await scheduleService.deleteSlot(scheduleData.schedule.id, slotId)
			toast.success('Слот удалён')
			loadSchedule()
		} catch {
			toast.error('Ошибка удаления')
		}
	}

	// Group slots by weekday (with optional student/teacher filter)
	const slotsByDay = {}
	if (scheduleData?.slots) {
		for (const slot of scheduleData.slots) {
			if (filterStudentId && slot.student_id !== Number(filterStudentId))
				continue
			if (filterTeacherId && slot.teacher_id !== Number(filterTeacherId))
				continue
			if (!slotsByDay[slot.weekday]) slotsByDay[slot.weekday] = []
			slotsByDay[slot.weekday].push(slot)
		}
	}

	const schedule = scheduleData?.schedule
	const stats = scheduleData?.stats
	const issues = scheduleData?.issues || []
	const isDraft = schedule?.status === 'draft'
	const isApproved = schedule?.status === 'approved'
	const canAddSlot = isDraft || isApproved

	return (
		<Container maxWidth='xl' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				{/* Header */}
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={3}
				>
					<Typography variant='h4'>Расписание</Typography>
					<Button
						startIcon={<BackIcon />}
						onClick={() => navigate('/admin/schedule')}
					>
						Назад
					</Button>
				</Box>

				{/* Week navigation */}
				<Box
					display='flex'
					alignItems='center'
					justifyContent='center'
					gap={2}
					mb={3}
				>
					<IconButton onClick={prevWeek} size='large'>
						<ChevronLeft />
					</IconButton>
					<Typography
						variant='h6'
						sx={{ minWidth: 320, textAlign: 'center', fontWeight: 500 }}
					>
						{formatWeekLabel(weekStart)}
					</Typography>
					<IconButton onClick={nextWeek} size='large'>
						<ChevronRight />
					</IconButton>
				</Box>

				{/* Action bar */}
				<Box display='flex' alignItems='center' gap={2} mb={3} flexWrap='wrap'>
					{schedule && (
						<Chip
							label={STATUS_LABELS[schedule.status] || schedule.status}
							color={STATUS_COLORS[schedule.status] || 'default'}
							size='medium'
						/>
					)}

					{!schedule && !loading && (
						<Button
							variant='contained'
							startIcon={<GenerateIcon />}
							onClick={generate}
							disabled={generating}
						>
							{generating ? 'Генерация...' : 'Сгенерировать расписание'}
						</Button>
					)}

					{isDraft && (
						<>
							<Button
								variant='contained'
								color='success'
								startIcon={<ApproveIcon />}
								onClick={approve}
							>
								Утвердить
							</Button>
							<Button
								variant='outlined'
								startIcon={<ResetIcon />}
								onClick={resetAuto}
								disabled={generating}
							>
								{generating ? 'Пересчёт...' : 'Сбросить авто'}
							</Button>
						</>
					)}

					{canAddSlot && (
						<Button
							variant='outlined'
							startIcon={<AddIcon />}
							onClick={openCreateSlot}
						>
							Добавить слот
						</Button>
					)}
				</Box>

				{/* Slot filters */}
				{schedule && (
					<Paper variant='outlined' sx={{ p: 2, mb: 3 }}>
						<Grid container spacing={2} alignItems='center'>
							<Grid item xs={12} sm={4}>
								<FormControl fullWidth size='small'>
									<InputLabel>Фильтр по ученику</InputLabel>
									<Select
										value={filterStudentId}
										label='Фильтр по ученику'
										onChange={e => setFilterStudentId(e.target.value)}
									>
										<MenuItem value=''>Все ученики</MenuItem>
										{students.map(s => (
											<MenuItem key={s.id} value={s.id}>
												{s.full_name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={4}>
								<FormControl fullWidth size='small'>
									<InputLabel>Фильтр по преподавателю</InputLabel>
									<Select
										value={filterTeacherId}
										label='Фильтр по преподавателю'
										onChange={e => setFilterTeacherId(e.target.value)}
									>
										<MenuItem value=''>Все преподаватели</MenuItem>
										{teachers.map(t => (
											<MenuItem key={t.id} value={t.id}>
												{t.full_name}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} sm={4}>
								<Button
									size='small'
									onClick={() => {
										setFilterStudentId('')
										setFilterTeacherId('')
									}}
									disabled={!filterStudentId && !filterTeacherId}
								>
									Сбросить фильтры
								</Button>
							</Grid>
						</Grid>
					</Paper>
				)}

				{/* Stats */}
				{stats && (
					<Paper variant='outlined' sx={{ p: 2, mb: 3 }}>
						<Grid container spacing={2} textAlign='center'>
							<Grid item xs={4}>
								<Typography variant='h4' color='primary.main'>
									{stats.total_requested}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Запрошено занятий
								</Typography>
							</Grid>
							<Grid item xs={4}>
								<Typography variant='h4' color='success.main'>
									{stats.scheduled}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Поставлено
								</Typography>
							</Grid>
							<Grid item xs={4}>
								<Typography
									variant='h4'
									color={stats.unplaced > 0 ? 'error.main' : 'text.secondary'}
								>
									{stats.unplaced}
								</Typography>
								<Typography variant='body2' color='text.secondary'>
									Не поставлено
								</Typography>
							</Grid>
						</Grid>
					</Paper>
				)}

				{/* Loading */}
				{loading && (
					<Box display='flex' justifyContent='center' p={4}>
						<CircularProgress />
					</Box>
				)}

				{/* No schedule */}
				{!loading && !schedule && (
					<Alert severity='info'>
						Расписание на эту неделю ещё не создано. Нажмите «Сгенерировать
						расписание», чтобы создать черновик.
					</Alert>
				)}

				{/* Slots grouped by weekday */}
				{!loading &&
					schedule &&
					Object.keys(WEEKDAY_NAMES).map(dayStr => {
						const day = Number(dayStr)
						const daySlots = slotsByDay[day] || []
						if (!daySlots.length) return null
						return (
							<Box key={day} mb={3}>
								<Typography
									variant='h6'
									sx={{ mb: 1, color: 'primary.main', fontWeight: 600 }}
								>
									{WEEKDAY_NAMES[day]}
								</Typography>
								<TableContainer>
									<Table size='small'>
										<TableHead>
											<TableRow>
												<TableCell>Время</TableCell>
												<TableCell>Ученик</TableCell>
												<TableCell>Преподаватель</TableCell>
												<TableCell>Предмет</TableCell>
												<TableCell>Кабинет</TableCell>
												<TableCell>Тип</TableCell>
												<TableCell>Статус</TableCell>
												<TableCell align='center'>Действия</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{daySlots.map(slot => (
												<TableRow key={slot.id}>
													<TableCell>
														{slot.start_time}–{slot.end_time}
													</TableCell>
													<TableCell>
														{slot.student?.full_name || slot.student_id}
													</TableCell>
													<TableCell>
														{slot.teacher?.full_name || slot.teacher_id}
													</TableCell>
													<TableCell>
														{slot.subject?.name || slot.subject_id}
													</TableCell>
													<TableCell>
														{slot.room?.name || slot.room_id}
													</TableCell>
													<TableCell>
														<Chip
															label={slot.origin === 'auto' ? 'Авто' : 'Ручной'}
															color={
																slot.origin === 'auto' ? 'secondary' : 'primary'
															}
															size='small'
															variant='outlined'
														/>
													</TableCell>
													<TableCell>
														<Chip
															label={
																SLOT_STATUS_LABELS[slot.status] || slot.status
															}
															color={
																SLOT_STATUS_COLORS[slot.status] || 'default'
															}
															size='small'
														/>
													</TableCell>
													<TableCell align='center'>
														<IconButton
															size='small'
															onClick={() => openEditSlot(slot)}
															title='Редактировать'
														>
															<EditIcon fontSize='small' />
														</IconButton>
														<IconButton
															size='small'
															color='error'
															onClick={() => deleteSlot(slot.id)}
															title='Удалить'
														>
															<DeleteIcon fontSize='small' />
														</IconButton>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
							</Box>
						)
					})}

				{!loading && schedule && scheduleData?.slots?.length === 0 && (
					<Alert severity='warning'>
						Слоты в расписании отсутствуют. Попробуйте сгенерировать или
						добавить слоты вручную.
					</Alert>
				)}

				{/* Issues */}
				{!loading && issues.length > 0 && (
					<Accordion sx={{ mt: 2 }}>
						<AccordionSummary expandIcon={<ExpandIcon />}>
							<Typography color='error.main'>
								Проблемы при генерации ({issues.length})
							</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<TableContainer>
								<Table size='small'>
									<TableHead>
										<TableRow>
											<TableCell>Код причины</TableCell>
											<TableCell>Ученик</TableCell>
											<TableCell>Преподаватель</TableCell>
											<TableCell>Предмет</TableCell>
											<TableCell>Сообщение</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{issues.map(issue => (
											<TableRow key={issue.id}>
												<TableCell>
													<Chip
														label={issue.reason_code}
														color='error'
														size='small'
														variant='outlined'
													/>
												</TableCell>
												<TableCell>
													{issue.student?.full_name || issue.student_id}
												</TableCell>
												<TableCell>
													{issue.teacher?.full_name || issue.teacher_id}
												</TableCell>
												<TableCell>
													{issue.subject?.name || issue.subject_id}
												</TableCell>
												<TableCell>{issue.message}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						</AccordionDetails>
					</Accordion>
				)}
			</Paper>

			{/* Create Slot Dialog */}
			<Dialog
				open={createDialog}
				onClose={() => setCreateDialog(false)}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Добавить слот вручную</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<FormControl fullWidth required>
							<InputLabel>Назначение</InputLabel>
							<Select
								value={slotForm.assignment_id}
								label='Назначение'
								onChange={e =>
									setSlotForm({ ...slotForm, assignment_id: e.target.value })
								}
							>
								{assignments.map(a => (
									<MenuItem key={a.id} value={a.id}>
										{a.student?.full_name || a.student_id} →{' '}
										{a.teacher?.full_name || a.teacher_id} (
										{a.subject?.name || a.subject_id})
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth required>
							<InputLabel>Кабинет</InputLabel>
							<Select
								value={slotForm.room_id}
								label='Кабинет'
								onChange={e =>
									setSlotForm({ ...slotForm, room_id: e.target.value })
								}
							>
								{rooms.map(r => (
									<MenuItem key={r.id} value={r.id}>
										{r.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>День недели</InputLabel>
							<Select
								value={slotForm.weekday}
								label='День недели'
								onChange={e =>
									setSlotForm({ ...slotForm, weekday: e.target.value })
								}
							>
								{Object.entries(WEEKDAY_NAMES).map(([k, v]) => (
									<MenuItem key={k} value={Number(k)}>
										{v}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Box display='flex' gap={2}>
							<TextField
								label='Начало (ЧЧ:ММ)'
								value={slotForm.start_time}
								onChange={e =>
									setSlotForm({ ...slotForm, start_time: e.target.value })
								}
								fullWidth
								placeholder='09:00'
							/>
							<TextField
								label='Конец (ЧЧ:ММ)'
								value={slotForm.end_time}
								onChange={e =>
									setSlotForm({ ...slotForm, end_time: e.target.value })
								}
								fullWidth
								placeholder='09:50'
							/>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setCreateDialog(false)}>Отмена</Button>
					<Button onClick={createSlot} variant='contained'>
						Добавить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Edit Slot Dialog */}
			<Dialog
				open={editDialog.open}
				onClose={() => setEditDialog({ open: false, slot: null })}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Редактировать слот</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<FormControl fullWidth>
							<InputLabel>День недели</InputLabel>
							<Select
								value={editForm.weekday}
								label='День недели'
								onChange={e =>
									setEditForm({ ...editForm, weekday: e.target.value })
								}
							>
								{Object.entries(WEEKDAY_NAMES).map(([k, v]) => (
									<MenuItem key={k} value={Number(k)}>
										{v}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Box display='flex' gap={2}>
							<TextField
								label='Начало (ЧЧ:ММ)'
								value={editForm.start_time}
								onChange={e =>
									setEditForm({ ...editForm, start_time: e.target.value })
								}
								fullWidth
							/>
							<TextField
								label='Конец (ЧЧ:ММ)'
								value={editForm.end_time}
								onChange={e =>
									setEditForm({ ...editForm, end_time: e.target.value })
								}
								fullWidth
							/>
						</Box>
						<FormControl fullWidth>
							<InputLabel>Кабинет</InputLabel>
							<Select
								value={editForm.room_id}
								label='Кабинет'
								onChange={e =>
									setEditForm({ ...editForm, room_id: e.target.value })
								}
							>
								{rooms.map(r => (
									<MenuItem key={r.id} value={r.id}>
										{r.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Статус</InputLabel>
							<Select
								value={editForm.status}
								label='Статус'
								onChange={e =>
									setEditForm({ ...editForm, status: e.target.value })
								}
							>
								<MenuItem value='scheduled'>Запланировано</MenuItem>
								<MenuItem value='moved'>Перенесено</MenuItem>
								<MenuItem value='cancelled'>Отменено</MenuItem>
							</Select>
						</FormControl>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setEditDialog({ open: false, slot: null })}>
						Отмена
					</Button>
					<Button onClick={saveEditSlot} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminSchedule
