import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container, Paper, Typography, Box, Button, Table, TableBody,
	TableCell, TableContainer, TableHead, TableRow, IconButton,
	Dialog, DialogTitle, DialogContent, DialogActions, TextField,
	Select, MenuItem, FormControl, InputLabel, Chip, Tooltip,
	CircularProgress, Alert, Divider, List, ListItem, ListItemText,
	ListItemSecondaryAction,
} from '@mui/material'
import {
	Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
	ArrowBack as BackIcon, PersonAdd as PersonAddIcon,
	PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const WEEKDAYS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

const AdminGroupLessons = () => {
	const navigate = useNavigate()
	const [groups, setGroups] = useState([])
	const [subjects, setSubjects] = useState([])
	const [teachers, setTeachers] = useState([])
	const [students, setStudents] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const [formOpen, setFormOpen] = useState(false)
	const [editingGroup, setEditingGroup] = useState(null)
	const [formData, setFormData] = useState({
		name: '', subject_id: '', default_teacher_id: '',
		visits_per_week: 1, duration_min: 50, max_students: 10, status: 'active', notes: '',
	})

	const [enrollOpen, setEnrollOpen] = useState(false)
	const [enrollGroup, setEnrollGroup] = useState(null)
	const [addStudentId, setAddStudentId] = useState('')

	const [deleteConfirm, setDeleteConfirm] = useState(null)

	const load = useCallback(async () => {
		try {
			setLoading(true)
			const [g, s, t, st] = await Promise.all([
				scheduleService.getGroupLessons(),
				scheduleService.getSubjects(),
				scheduleService.getTeachers(),
				scheduleService.getStudents(),
			])
			setGroups(g)
			setSubjects(s)
			setTeachers(t)
			setStudents(st)
		} catch {
			setError('Не удалось загрузить данные')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => { load() }, [load])

	const openCreate = () => {
		setEditingGroup(null)
		setFormData({
			name: '', subject_id: '', default_teacher_id: '',
			visits_per_week: 1, duration_min: 50, max_students: 10, status: 'active', notes: '',
		})
		setFormOpen(true)
	}

	const openEdit = group => {
		setEditingGroup(group)
		setFormData({
			name: group.name,
			subject_id: group.subject_id || '',
			default_teacher_id: group.default_teacher_id || '',
			visits_per_week: group.visits_per_week,
			duration_min: group.duration_min,
			max_students: group.max_students,
			status: group.status,
			notes: group.notes || '',
		})
		setFormOpen(true)
	}

	const handleSave = async () => {
		if (!formData.name.trim()) { toast.error('Введите название группы'); return }
		if (!formData.subject_id) { toast.error('Выберите предмет'); return }
		if (formData.visits_per_week < 1) { toast.error('Занятий в неделю должно быть >= 1'); return }
		if (formData.duration_min < 1) { toast.error('Длительность должна быть >= 1 мин'); return }

		const payload = {
			name: formData.name.trim(),
			subject_id: Number(formData.subject_id),
			default_teacher_id: formData.default_teacher_id ? Number(formData.default_teacher_id) : null,
			visits_per_week: Number(formData.visits_per_week),
			duration_min: Number(formData.duration_min),
			max_students: Number(formData.max_students),
			status: formData.status,
			notes: formData.notes.trim() || null,
		}

		try {
			if (editingGroup) {
				await scheduleService.updateGroupLesson(editingGroup.id, payload)
				toast.success('Группа обновлена')
			} else {
				await scheduleService.createGroupLesson(payload)
				toast.success('Группа создана')
			}
			setFormOpen(false)
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const handleDelete = async () => {
		try {
			await scheduleService.deleteGroupLesson(deleteConfirm.id)
			toast.success('Группа удалена')
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

	const handleAddStudent = async () => {
		if (!addStudentId) { toast.error('Выберите ученика'); return }
		try {
			await scheduleService.addGroupEnrollment(enrollGroup.id, Number(addStudentId))
			toast.success('Ученик добавлен')
			setAddStudentId('')
			const updated = await scheduleService.getGroupLessonById(enrollGroup.id)
			setEnrollGroup(updated)
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка')
		}
	}

	const handleRemoveStudent = async studentId => {
		try {
			await scheduleService.removeGroupEnrollment(enrollGroup.id, studentId)
			toast.success('Ученик удалён из группы')
			const updated = await scheduleService.getGroupLessonById(enrollGroup.id)
			setEnrollGroup(updated)
			load()
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
							Группы учеников с общим преподавателем и предметом
						</Typography>
					</Box>
					<Box display='flex' gap={1}>
						<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')}>
							Назад
						</Button>
						<Button variant='contained' startIcon={<AddIcon />} onClick={openCreate}>
							Создать группу
						</Button>
					</Box>
				</Box>

				{error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

				<TableContainer>
					<Table size='small'>
						<TableHead>
							<TableRow>
								<TableCell>Название</TableCell>
								<TableCell>Предмет</TableCell>
								<TableCell>Преподаватель (по умолч.)</TableCell>
								<TableCell align='center'>Занятий/нед.</TableCell>
								<TableCell align='center'>Длит. (мин)</TableCell>
								<TableCell align='center'>Учеников</TableCell>
								<TableCell>Статус</TableCell>
								<TableCell align='right'>Действия</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{groups.length === 0 && (
								<TableRow>
									<TableCell colSpan={8} align='center'>
										<Typography color='text.secondary'>Групп пока нет</Typography>
									</TableCell>
								</TableRow>
							)}
							{groups.map(g => (
								<TableRow key={g.id} hover>
									<TableCell><strong>{g.name}</strong></TableCell>
									<TableCell>{g.subject?.name || '—'}</TableCell>
									<TableCell>{g.default_teacher?.full_name || '—'}</TableCell>
									<TableCell align='center'>{g.visits_per_week}</TableCell>
									<TableCell align='center'>{g.duration_min}</TableCell>
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
											label={g.status === 'active' ? 'Активна' : 'Приост.'}
											color={g.status === 'active' ? 'success' : 'default'}
										/>
									</TableCell>
									<TableCell align='right'>
										<Tooltip title='Состав группы'>
											<IconButton size='small' onClick={() => openEnroll(g)}>
												<PersonAddIcon fontSize='small' />
											</IconButton>
										</Tooltip>
										<Tooltip title='Редактировать'>
											<IconButton size='small' onClick={() => openEdit(g)}>
												<EditIcon fontSize='small' />
											</IconButton>
										</Tooltip>
										<Tooltip title='Удалить'>
											<IconButton size='small' color='error' onClick={() => setDeleteConfirm(g)}>
												<DeleteIcon fontSize='small' />
											</IconButton>
										</Tooltip>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</Paper>

			{/* Форма создания/редактирования */}
			<Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth='sm' fullWidth>
				<DialogTitle>{editingGroup ? 'Редактировать группу' : 'Создать группу'}</DialogTitle>
				<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
					<TextField
						label='Название группы' fullWidth required
						value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
					/>
					<FormControl fullWidth required>
						<InputLabel>Предмет</InputLabel>
						<Select
							value={formData.subject_id} label='Предмет'
							onChange={e => setFormData(p => ({ ...p, subject_id: e.target.value }))}
						>
							{subjects.filter(s => s.is_active).map(s => (
								<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
							))}
						</Select>
					</FormControl>
					<FormControl fullWidth>
						<InputLabel>Преподаватель по умолчанию</InputLabel>
						<Select
							value={formData.default_teacher_id} label='Преподаватель по умолчанию'
							onChange={e => setFormData(p => ({ ...p, default_teacher_id: e.target.value }))}
						>
							<MenuItem value=''>— Не указан —</MenuItem>
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
							value={formData.status} label='Статус'
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
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setFormOpen(false)}>Отмена</Button>
					<Button variant='contained' onClick={handleSave}>
						{editingGroup ? 'Сохранить' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Управление составом группы */}
			<Dialog open={enrollOpen} onClose={() => setEnrollOpen(false)} maxWidth='sm' fullWidth>
				<DialogTitle>
					Состав группы: {enrollGroup?.name}
					<Typography variant='caption' display='block' color='text.secondary'>
						{enrollGroup?.subject?.name} · {enrollGroup?.visits_per_week} раз/нед · {enrollGroup?.duration_min} мин
					</Typography>
				</DialogTitle>
				<DialogContent>
					<Typography variant='subtitle2' gutterBottom>Добавить ученика</Typography>
					<Box display='flex' gap={1} mb={2}>
						<FormControl fullWidth size='small'>
							<InputLabel>Ученик</InputLabel>
							<Select
								value={addStudentId} label='Ученик'
								onChange={e => setAddStudentId(e.target.value)}
							>
								{availableStudents.map(s => (
									<MenuItem key={s.id} value={s.id}>
										{s.full_name} ({s.funding_type === 'paid' ? 'платник' : 'бюджет'})
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Button variant='contained' onClick={handleAddStudent} disabled={!addStudentId}>
							Добавить
						</Button>
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
								<ListItemText
									primary={e.student?.full_name}
									secondary={e.student?.funding_type === 'paid' ? 'Платник' : 'Бюджетник'}
								/>
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

			{/* Подтверждение удаления */}
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
