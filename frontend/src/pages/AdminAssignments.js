import './AdminModule.scss'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Typography,
	Box,
	Button,
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
	Chip,
	CircularProgress,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Grid,
	Autocomplete,
} from '@mui/material'
import {
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	ArrowBack as BackIcon,
	FilterList as FilterIcon,
	Pause as PauseIcon,
	PlayArrow as PlayIcon,
} from '@mui/icons-material'
import Tooltip from '@mui/material/Tooltip'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const EMPTY_ASSIGNMENT = {
	student_id: '',
	teacher_id: '',
	subject_id: '',
	funding_type: 'budget',
	visits_per_week: 1,
	duration_min: 50,
	status: 'active',
}

const AdminAssignments = () => {
	const navigate = useNavigate()
	const [assignments, setAssignments] = useState([])
	const [students, setStudents] = useState([])
	const [teachers, setTeachers] = useState([])
	const [subjects, setSubjects] = useState([])
	const [loading, setLoading] = useState(true)

	const [filters, setFilters] = useState({
		teacher_id: '',
		student_id: '',
		subject_id: '',
		status: '',
	})

	const [editDialog, setEditDialog] = useState({ open: false, item: null })
	const [form, setForm] = useState(EMPTY_ASSIGNMENT)
	const [teacherSubjectIds, setTeacherSubjectIds] = useState([])

	useEffect(() => {
		loadAll()
	}, [])

	useEffect(() => {
		if (!form.teacher_id) {
			setTeacherSubjectIds([])
			return
		}
		scheduleService.getTeacherSubjects(form.teacher_id).then(data => {
			setTeacherSubjectIds(data.map(ts => ts.subject_id))
		}).catch(() => {
			setTeacherSubjectIds([])
		})
	}, [form.teacher_id])

	const loadAll = async () => {
		try {
			const [studentsData, teachersData, subjectsData, assignmentsData] =
				await Promise.all([
					scheduleService.getStudents(),
					scheduleService.getTeachers(),
					scheduleService.getSubjects(),
					scheduleService.getAssignments(),
				])
			setStudents(studentsData)
			setTeachers(teachersData)
			setSubjects(subjectsData)
			setAssignments(assignmentsData)
		} catch {
			toast.error('Ошибка загрузки данных')
		} finally {
			setLoading(false)
		}
	}

	const loadAssignments = async (f = filters) => {
		const params = {}
		if (f.teacher_id) params.teacher_id = f.teacher_id
		if (f.student_id) params.student_id = f.student_id
		if (f.subject_id) params.subject_id = f.subject_id
		if (f.status) params.status = f.status
		try {
			const data = await scheduleService.getAssignments(params)
			setAssignments(data)
		} catch {
			toast.error('Ошибка загрузки назначений')
		}
	}

	const applyFilters = () => loadAssignments(filters)

	const resetFilters = () => {
		const empty = { teacher_id: '', student_id: '', subject_id: '', status: '' }
		setFilters(empty)
		loadAssignments(empty)
	}

	const openCreate = () => {
		setForm(EMPTY_ASSIGNMENT)
		setEditDialog({ open: true, item: null })
	}

	const openEdit = item => {
		setForm({
			student_id: item.student_id,
			teacher_id: item.teacher_id,
			subject_id: item.subject_id,
			funding_type: item.funding_type || 'budget',
			visits_per_week: item.visits_per_week,
			duration_min: item.duration_min,
			status: item.status,
		})
		setEditDialog({ open: true, item })
	}

	const closeEdit = () => setEditDialog({ open: false, item: null })

	const saveAssignment = async () => {
		if (!form.student_id || !form.teacher_id || !form.subject_id) {
			toast.error('Выберите ученика, преподавателя и предмет')
			return
		}
		try {
			const data = { ...form }
			if (editDialog.item) {
				await scheduleService.updateAssignment(editDialog.item.id, data)
				toast.success('Назначение обновлено')
			} else {
				await scheduleService.createAssignment(data)
				toast.success('Назначение создано')
			}
			closeEdit()
			loadAssignments()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const deleteAssignment = async a => {
		if (!window.confirm(`Удалить назначение? Если к нему привязаны слоты расписания — удаление не сработает.`))
			return
		try {
			await scheduleService.deleteAssignment(a.id)
			toast.success('Назначение удалено')
			loadAssignments()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления (возможно, есть связанные слоты)')
		}
	}

	const toggleAssignmentStatus = async a => {
		const newStatus = a.status === 'active' ? 'paused' : 'active'
		try {
			await scheduleService.updateAssignment(a.id, { status: newStatus })
			toast.success(
				newStatus === 'paused'
					? 'Назначение приостановлено'
					: 'Назначение возобновлено',
			)
			loadAssignments()
		} catch {
			toast.error('Ошибка изменения статуса')
		}
	}

	const findName = (arr, id, field) =>
		arr.find(x => x.id === id)?.[field] || '—'

	return (
		<main className='admin-module'>
			<div className='admin-module__container'>
				<section className='admin-module__hero'>
					<div>
						<span className='admin-module__badge'>Расписание</span>
						<h1>Назначения</h1>
						<p>Связки ученик — преподаватель — предмет для формирования расписания занятий.</p>
					</div>
					<div className='admin-module__actions'>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/admin/schedule')}
							className='admin-module__button admin-module__button--ghost'
						>
							Назад
						</Button>
						<Button
							startIcon={<AddIcon />}
							onClick={openCreate}
							className='admin-module__button admin-module__button--primary'
						>
							Добавить
						</Button>
					</div>
				</section>

				<section className='admin-module__panel'>
				{/* Filters */}
				<Box sx={{ p: 2, mb: 3, border: '1px solid rgba(7,68,98,0.14)', borderRadius: '16px', background: 'rgba(244,223,0,0.08)' }}>
					<Box display='flex' alignItems='center' gap={1} mb={1.5}>
						<FilterIcon fontSize='small' color='action' />
						<Typography variant='subtitle2'>Фильтры</Typography>
					</Box>
					<Grid container spacing={2}>
						<Grid item xs={12} sm={6} md={3}>
							<FormControl fullWidth size='small'>
								<InputLabel>Ученик</InputLabel>
								<Select
									value={filters.student_id}
									label='Ученик'
									onChange={e =>
										setFilters({ ...filters, student_id: e.target.value })
									}
								>
									<MenuItem value=''>Все</MenuItem>
									{students.map(s => (
										<MenuItem key={s.id} value={s.id}>
											{s.full_name}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<FormControl fullWidth size='small'>
								<InputLabel>Преподаватель</InputLabel>
								<Select
									value={filters.teacher_id}
									label='Преподаватель'
									onChange={e =>
										setFilters({ ...filters, teacher_id: e.target.value })
									}
								>
									<MenuItem value=''>Все</MenuItem>
									{teachers.map(t => (
										<MenuItem key={t.id} value={t.id}>
											{t.full_name}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<FormControl fullWidth size='small'>
								<InputLabel>Предмет</InputLabel>
								<Select
									value={filters.subject_id}
									label='Предмет'
									onChange={e =>
										setFilters({ ...filters, subject_id: e.target.value })
									}
								>
									<MenuItem value=''>Все</MenuItem>
									{subjects.map(s => (
										<MenuItem key={s.id} value={s.id}>
											{s.name}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<FormControl fullWidth size='small'>
								<InputLabel>Статус</InputLabel>
								<Select
									value={filters.status}
									label='Статус'
									onChange={e =>
										setFilters({ ...filters, status: e.target.value })
									}
								>
									<MenuItem value=''>Все</MenuItem>
									<MenuItem value='active'>Активные</MenuItem>
									<MenuItem value='paused'>Приостановленные</MenuItem>
								</Select>
							</FormControl>
						</Grid>
					</Grid>
					<Box display='flex' gap={1} mt={2}>
						<Button size='small' variant='contained' onClick={applyFilters}>
							Применить
						</Button>
						<Button size='small' onClick={resetFilters}>
							Сбросить
						</Button>
					</Box>
				</Box>

				{loading ? (
					<Box display='flex' justifyContent='center' p={4}>
						<CircularProgress />
					</Box>
				) : (
					<TableContainer>
						<Table>
							<TableHead>
								<TableRow>
									<TableCell>ID</TableCell>
									<TableCell>Ученик</TableCell>
									<TableCell>Преподаватель</TableCell>
									<TableCell>Предмет</TableCell>
									<TableCell>Тип</TableCell>
									<TableCell>Зан./нед.</TableCell>
									<TableCell>Длит.</TableCell>
									<TableCell>Статус</TableCell>
									<TableCell align='center'>Действия</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{assignments.map(a => (
									<TableRow key={a.id}>
										<TableCell>{a.id}</TableCell>
										<TableCell>
											{a.student?.full_name ||
												findName(students, a.student_id, 'full_name')}
										</TableCell>
										<TableCell>
											{a.teacher?.full_name ||
												findName(teachers, a.teacher_id, 'full_name')}
										</TableCell>
										<TableCell>
											{a.subject?.name ||
												findName(subjects, a.subject_id, 'name')}
										</TableCell>
										<TableCell>
											<Chip
												label={a.funding_type === 'paid' ? 'Платник' : 'Бюджет'}
												color={a.funding_type === 'paid' ? 'error' : 'success'}
												size='small'
											/>
										</TableCell>
										<TableCell>{a.visits_per_week}</TableCell>
										<TableCell>{a.duration_min} мин</TableCell>
										<TableCell>
											<Chip
												label={a.status === 'active' ? 'Активен' : 'Пауза'}
												color={a.status === 'active' ? 'success' : 'warning'}
												size='small'
											/>
										</TableCell>
										<TableCell align='center'>
											<IconButton
												onClick={() => openEdit(a)}
												size='small'
												title='Редактировать'
											>
												<EditIcon />
											</IconButton>
											<Tooltip
												title={
													a.status === 'active'
														? 'Приостановить'
														: 'Возобновить'
												}
											>
												<IconButton
													onClick={() => toggleAssignmentStatus(a)}
													size='small'
													color={a.status === 'active' ? 'warning' : 'success'}
												>
													{a.status === 'active' ? <PauseIcon /> : <PlayIcon />}
												</IconButton>
											</Tooltip>
											<Tooltip title='Удалить назначение'>
												<IconButton
													onClick={() => deleteAssignment(a)}
													size='small'
													color='error'
												>
													<DeleteIcon />
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
								{!assignments.length && (
									<TableRow>
										<TableCell colSpan={9} align='center'>
											<Typography color='text.secondary'>
												Назначения не найдены
											</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</section>

			{/* Edit Dialog */}
			<Dialog
				open={editDialog.open}
				onClose={closeEdit}
				maxWidth='sm'
				fullWidth
				PaperProps={{ className: 'admin-module-dialog' }}
			>
				<DialogTitle className='admin-module-dialog__title'>
					{editDialog.item ? 'Редактировать назначение' : 'Новое назначение'}
				</DialogTitle>
				<DialogContent className='admin-module-dialog__content'>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<Autocomplete
							options={students}
							getOptionLabel={s => s.full_name + (!s.is_active ? ' (неактивен)' : '')}
							value={students.find(s => s.id === form.student_id) || null}
							onChange={(_, val) => setForm({ ...form, student_id: val?.id || '' })}
							renderInput={params => (
								<TextField {...params} label='Ученик' required />
							)}
							isOptionEqualToValue={(o, v) => o.id === v.id}
						/>
						<Autocomplete
							options={teachers}
							getOptionLabel={t => t.full_name + (!t.is_active ? ' (неактивен)' : '')}
							value={teachers.find(t => t.id === form.teacher_id) || null}
							onChange={(_, val) =>
								setForm({ ...form, teacher_id: val?.id || '', subject_id: '' })
							}
							renderInput={params => (
								<TextField {...params} label='Преподаватель' required />
							)}
							isOptionEqualToValue={(o, v) => o.id === v.id}
						/>
						<FormControl fullWidth required>
							<InputLabel>Предмет</InputLabel>
							<Select
								value={form.subject_id}
								label='Предмет'
								onChange={e => setForm({ ...form, subject_id: e.target.value })}
							>
								{(teacherSubjectIds.length > 0
									? subjects.filter(s => teacherSubjectIds.includes(s.id))
									: subjects
								).map(s => (
									<MenuItem key={s.id} value={s.id}>
										{s.name}
										{!s.is_active ? ' (неактивен)' : ''}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Тип финансирования</InputLabel>
							<Select
								value={form.funding_type}
								label='Тип финансирования'
								onChange={e => setForm({ ...form, funding_type: e.target.value })}
							>
								<MenuItem value='budget'>Бюджет</MenuItem>
								<MenuItem value='paid'>Платник</MenuItem>
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Занятий в неделю</InputLabel>
							<Select
								value={form.visits_per_week}
								label='Занятий в неделю'
								onChange={e =>
									setForm({ ...form, visits_per_week: e.target.value })
								}
							>
								{[1, 2, 3, 4, 5].map(n => (
									<MenuItem key={n} value={n}>{n}</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Длительность занятия</InputLabel>
							<Select
								value={form.duration_min}
								label='Длительность занятия'
								onChange={e =>
									setForm({ ...form, duration_min: e.target.value })
								}
							>
								<MenuItem value={30}>30 минут</MenuItem>
								<MenuItem value={50}>50 минут</MenuItem>
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Статус</InputLabel>
							<Select
								value={form.status}
								label='Статус'
								onChange={e => setForm({ ...form, status: e.target.value })}
							>
								<MenuItem value='active'>Активен</MenuItem>
								<MenuItem value='paused'>Приостановлен</MenuItem>
							</Select>
						</FormControl>
					</Box>
				</DialogContent>
				<DialogActions className='admin-module-dialog__actions'>
					<Button onClick={closeEdit}>Отмена</Button>
					<Button onClick={saveAssignment} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>
		</div>
		</main>
	)
}

export default AdminAssignments
