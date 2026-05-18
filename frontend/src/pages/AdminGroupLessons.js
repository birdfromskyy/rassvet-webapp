import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Alert,
	Box,
	Button,
	Checkbox,
	Chip,
	CircularProgress,
	Container,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	FormControlLabel,
	IconButton,
	InputLabel,
	List,
	ListItem,
	ListItemSecondaryAction,
	ListItemText,
	MenuItem,
	Paper,
	Select,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Tooltip,
	Typography,
} from '@mui/material'
import {
	Add as AddIcon,
	ArrowBack as BackIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	Pause as PauseIcon,
	PersonAdd as PersonAddIcon,
	PersonRemove as PersonRemoveIcon,
	PlayArrow as PlayIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const EMPTY_FORM = {
	name: '',
	default_teacher_id: '',
	room_name: '',
	visits_per_week: 1,
	duration_min: 50,
	max_students: 10,
	status: 'active',
	notes: '',
	ignore_student_windows: false,
}

const AdminGroupLessons = () => {
	const navigate = useNavigate()
	const [groups, setGroups] = useState([])
	const [teachers, setTeachers] = useState([])
	const [students, setStudents] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const [formOpen, setFormOpen] = useState(false)
	const [editingGroup, setEditingGroup] = useState(null)
	const [formData, setFormData] = useState(EMPTY_FORM)

	const [enrollOpen, setEnrollOpen] = useState(false)
	const [enrollGroup, setEnrollGroup] = useState(null)
	const [addStudentId, setAddStudentId] = useState('')
	const [deleteConfirm, setDeleteConfirm] = useState(null)

	const load = useCallback(async () => {
		try {
			setLoading(true)
			const [g, t, st] = await Promise.all([
				scheduleService.getGroupLessons(),
				scheduleService.getTeachers(),
				scheduleService.getStudents(),
			])
			setGroups(g)
			setTeachers(t)
			setStudents(st)
			setError('')
		} catch {
			setError('Не удалось загрузить данные')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => { load() }, [load])

	const openCreate = () => {
		setEditingGroup(null)
		setFormData(EMPTY_FORM)
		setFormOpen(true)
	}

	const openEdit = group => {
		setEditingGroup(group)
		setFormData({
			name: group.name || '',
			default_teacher_id: group.default_teacher_id || '',
			room_name: group.room_name || '',
			visits_per_week: group.visits_per_week || 1,
			duration_min: group.duration_min || 50,
			max_students: group.max_students || 10,
			status: group.status || 'active',
			notes: group.notes || '',
			ignore_student_windows: group.ignore_student_windows || false,
		})
		setFormOpen(true)
	}

	const handleSave = async () => {
		if (!formData.name.trim()) { toast.error('Введите название группового занятия'); return }
		if (!formData.room_name.trim()) { toast.error('Введите кабинет или место проведения'); return }
		if (Number(formData.visits_per_week) < 1) { toast.error('Занятий в неделю должно быть не меньше 1'); return }
		if (Number(formData.duration_min) < 1) { toast.error('Длительность должна быть не меньше 1 минуты'); return }

		const payload = {
			name: formData.name.trim(),
			subject_id: null,
			default_teacher_id: formData.default_teacher_id ? Number(formData.default_teacher_id) : null,
			room_name: formData.room_name.trim(),
			visits_per_week: Number(formData.visits_per_week),
			duration_min: Number(formData.duration_min),
			max_students: Number(formData.max_students),
			status: formData.status,
			notes: formData.notes.trim() || null,
			ignore_student_windows: formData.ignore_student_windows,
		}

		try {
			if (editingGroup) {
				await scheduleService.updateGroupLesson(editingGroup.id, payload)
				toast.success('Групповое занятие обновлено')
			} else {
				await scheduleService.createGroupLesson(payload)
				toast.success('Групповое занятие создано')
			}
			setFormOpen(false)
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const toggleStatus = async group => {
		const newStatus = group.status === 'active' ? 'paused' : 'active'
		try {
			await scheduleService.updateGroupLesson(group.id, { status: newStatus })
			toast.success(newStatus === 'active' ? 'Группа возобновлена' : 'Группа приостановлена')
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleDelete = async () => {
		try {
			await scheduleService.deleteGroupLesson(deleteConfirm.id)
			toast.success('Групповое занятие удалено')
			setDeleteConfirm(null)
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления')
		}
	}

	const openEnroll = group => {
		setEnrollGroup(group)
		setAddStudentId('')
		setEnrollOpen(true)
	}

	const refreshEnrollGroup = async () => {
		const updated = await scheduleService.getGroupLessonById(enrollGroup.id)
		setEnrollGroup(updated)
		load()
	}

	const handleAddStudent = async () => {
		if (!addStudentId) { toast.error('Выберите ученика'); return }
		try {
			await scheduleService.addGroupEnrollment(enrollGroup.id, Number(addStudentId))
			toast.success('Ученик добавлен')
			setAddStudentId('')
			refreshEnrollGroup()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleRemoveStudent = async studentId => {
		try {
			await scheduleService.removeGroupEnrollment(enrollGroup.id, studentId)
			toast.success('Ученик удалён из группы')
			refreshEnrollGroup()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const enrolledIds = enrollGroup?.enrollments?.map(e => e.student_id) || []
	const availableStudents = students.filter(s => !enrolledIds.includes(s.id))

	if (loading) return <Box display='flex' justifyContent='center' mt={6}><CircularProgress /></Box>

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Box>
						<Typography variant='h5'>Групповые занятия</Typography>
						<Typography variant='body2' color='text.secondary'>
							Занятия с произвольным названием, преподавателем, текстовым кабинетом и составом учеников
						</Typography>
					</Box>
					<Box display='flex' gap={1}>
						<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')}>Назад</Button>
						<Button variant='contained' startIcon={<AddIcon />} onClick={openCreate}>Создать группу</Button>
					</Box>
				</Box>

				{error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

				<TableContainer>
					<Table size='small'>
						<TableHead>
							<TableRow>
								<TableCell>Название</TableCell>
								<TableCell>Преподаватель</TableCell>
								<TableCell>Кабинет</TableCell>
								<TableCell align='center'>Занятий/нед.</TableCell>
								<TableCell align='center'>Длительность</TableCell>
								<TableCell align='center'>Ученики</TableCell>
								<TableCell>Статус</TableCell>
								<TableCell>Примечания</TableCell>
								<TableCell align='right'>Действия</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{groups.length === 0 && (
								<TableRow>
									<TableCell colSpan={9} align='center'>
										<Typography color='text.secondary'>Групповых занятий пока нет</Typography>
									</TableCell>
								</TableRow>
							)}
							{groups.map(g => (
								<TableRow key={g.id} hover>
									<TableCell><strong>{g.name}</strong></TableCell>
									<TableCell>{g.default_teacher?.full_name || '-'}</TableCell>
									<TableCell>{g.room_name || '-'}</TableCell>
									<TableCell align='center'>{g.visits_per_week}</TableCell>
									<TableCell align='center'>{g.duration_min} мин</TableCell>
									<TableCell align='center'>
										<Chip
											size='small'
											label={`${g.enrollments?.length || 0} / ${g.max_students}`}
											color={(g.enrollments?.length || 0) >= g.max_students ? 'error' : 'success'}
										/>
									</TableCell>
									<TableCell>
										<Chip
											size='small'
											label={g.status === 'active' ? 'Активна' : 'Приостановлена'}
											color={g.status === 'active' ? 'success' : 'default'}
										/>
									</TableCell>
									<TableCell>{g.notes || '-'}</TableCell>
									<TableCell align='right'>
										<Tooltip title='Состав группы'>
											<IconButton size='small' onClick={() => openEnroll(g)}><PersonAddIcon fontSize='small' /></IconButton>
										</Tooltip>
										<Tooltip title={g.status === 'active' ? 'Приостановить' : 'Возобновить'}>
											<IconButton size='small' color={g.status === 'active' ? 'warning' : 'success'} onClick={() => toggleStatus(g)}>
												{g.status === 'active' ? <PauseIcon fontSize='small' /> : <PlayIcon fontSize='small' />}
											</IconButton>
										</Tooltip>
										<Tooltip title='Редактировать'>
											<IconButton size='small' onClick={() => openEdit(g)}><EditIcon fontSize='small' /></IconButton>
										</Tooltip>
										<Tooltip title='Удалить'>
											<IconButton size='small' color='error' onClick={() => setDeleteConfirm(g)}><DeleteIcon fontSize='small' /></IconButton>
										</Tooltip>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</Paper>

			<Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth='sm' fullWidth>
				<DialogTitle>{editingGroup ? 'Редактировать группу' : 'Создать группу'}</DialogTitle>
				<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
					<TextField
						label='Название группового занятия' fullWidth required
						value={formData.name}
						onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
					/>
					<TextField
						label='Кабинет / место проведения' fullWidth required
						value={formData.room_name}
						onChange={e => setFormData(p => ({ ...p, room_name: e.target.value }))}
					/>
					<FormControl fullWidth>
						<InputLabel>Преподаватель по умолчанию</InputLabel>
						<Select
							value={formData.default_teacher_id}
							label='Преподаватель по умолчанию'
							onChange={e => setFormData(p => ({ ...p, default_teacher_id: e.target.value }))}
						>
							<MenuItem value=''>Не указан</MenuItem>
							{teachers.filter(t => t.is_active).map(t => (
								<MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>
							))}
						</Select>
					</FormControl>
					<Box display='flex' gap={2}>
						<TextField
							label='Занятий в неделю' type='number' fullWidth required
							inputProps={{ min: 1, max: 6 }}
							value={formData.visits_per_week}
							onChange={e => setFormData(p => ({ ...p, visits_per_week: e.target.value }))}
						/>
						<TextField
							label='Длительность (мин)' type='number' fullWidth required
							inputProps={{ min: 15, max: 180 }}
							value={formData.duration_min}
							onChange={e => setFormData(p => ({ ...p, duration_min: e.target.value }))}
						/>
						<TextField
							label='Макс. учеников' type='number' fullWidth
							inputProps={{ min: 2, max: 50 }}
							value={formData.max_students}
							onChange={e => setFormData(p => ({ ...p, max_students: e.target.value }))}
						/>
					</Box>
					<FormControl fullWidth>
						<InputLabel>Статус</InputLabel>
						<Select
							value={formData.status}
							label='Статус'
							onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
						>
							<MenuItem value='active'>Активна</MenuItem>
							<MenuItem value='paused'>Приостановлена</MenuItem>
						</Select>
					</FormControl>
					<TextField
						label='Примечания' fullWidth multiline rows={2}
						value={formData.notes}
						onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
					/>
					<FormControlLabel
						control={
							<Checkbox
								checked={formData.ignore_student_windows}
								onChange={e => setFormData(p => ({ ...p, ignore_student_windows: e.target.checked }))}
							/>
						}
						label='Игнорировать окна детей при расстановке (не проверять пересечение доступности и максимальный разрыв)'
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setFormOpen(false)}>Отмена</Button>
					<Button variant='contained' onClick={handleSave}>{editingGroup ? 'Сохранить' : 'Создать'}</Button>
				</DialogActions>
			</Dialog>

			<Dialog open={enrollOpen} onClose={() => setEnrollOpen(false)} maxWidth='sm' fullWidth>
				<DialogTitle>
					Состав группы: {enrollGroup?.name}
					<Typography variant='caption' display='block' color='text.secondary'>
						{enrollGroup?.room_name || '-'} · {enrollGroup?.visits_per_week} раз/нед · {enrollGroup?.duration_min} мин
					</Typography>
				</DialogTitle>
				<DialogContent>
					<Typography variant='subtitle2' gutterBottom>Добавить ученика</Typography>
					<Box display='flex' gap={1} mb={2}>
						<FormControl fullWidth size='small'>
							<InputLabel>Ученик</InputLabel>
							<Select value={addStudentId} label='Ученик' onChange={e => setAddStudentId(e.target.value)}>
								{availableStudents.map(s => (
									<MenuItem key={s.id} value={s.id}>{s.full_name}</MenuItem>
								))}
							</Select>
						</FormControl>
						<Button variant='contained' onClick={handleAddStudent} disabled={!addStudentId}>Добавить</Button>
					</Box>
					<Divider sx={{ mb: 1 }} />
					<Typography variant='subtitle2' gutterBottom>
						Текущий состав ({enrollGroup?.enrollments?.length || 0} / {enrollGroup?.max_students})
					</Typography>
					{(!enrollGroup?.enrollments || enrollGroup.enrollments.length === 0) && (
						<Typography color='text.secondary' variant='body2'>В группе нет учеников</Typography>
					)}
					<List dense>
						{(enrollGroup?.enrollments || []).map(e => (
							<ListItem key={e.id} disableGutters>
								<ListItemText primary={e.student?.full_name || `Ученик #${e.student_id}`} />
								<ListItemSecondaryAction>
									<Tooltip title='Удалить из группы'>
										<IconButton size='small' color='error' onClick={() => handleRemoveStudent(e.student_id)}>
											<PersonRemoveIcon fontSize='small' />
										</IconButton>
									</Tooltip>
								</ListItemSecondaryAction>
							</ListItem>
						))}
					</List>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setEnrollOpen(false)}>Закрыть</Button>
				</DialogActions>
			</Dialog>

			<Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
				<DialogTitle>Удалить группу?</DialogTitle>
				<DialogContent>
					<Typography>Удалить группу «{deleteConfirm?.name}»? Это действие нельзя отменить.</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDeleteConfirm(null)}>Отмена</Button>
					<Button variant='contained' color='error' onClick={handleDelete}>Удалить</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminGroupLessons
