import React, { useState, useEffect } from 'react'
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
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Switch,
	FormControlLabel,
	Chip,
	CircularProgress,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	OutlinedInput,
	Checkbox,
	ListItemText,
	Divider,
} from '@mui/material'
import {
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	Block as DeactivateIcon,
	ArrowBack as BackIcon,
	School as SubjectsIcon,
	AccessTime as AvailIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const WEEKDAY_FULL = {
	1: 'Понедельник',
	2: 'Вторник',
	3: 'Среда',
	4: 'Четверг',
	5: 'Пятница',
	6: 'Суббота',
}

const EMPTY_TEACHER = {
	full_name: '',
	phone: '',
	is_active: true,
	notes: '',
}

const EMPTY_AVAIL = { weekday: 1, start_time: '09:00', end_time: '18:00' }

const AdminTeachers = () => {
	const navigate = useNavigate()
	const [teachers, setTeachers] = useState([])
	const [allSubjects, setAllSubjects] = useState([])
	const [loading, setLoading] = useState(true)

	// Edit dialog
	const [editDialog, setEditDialog] = useState({ open: false, item: null })
	const [form, setForm] = useState(EMPTY_TEACHER)

	// Subjects dialog
	const [subjectsDialog, setSubjectsDialog] = useState({
		open: false,
		teacher: null,
	})
	const [selectedSubjectIds, setSelectedSubjectIds] = useState([])

	// Availability dialog
	const [availDialog, setAvailDialog] = useState({ open: false, teacher: null })
	const [availList, setAvailList] = useState([])
	const [availForm, setAvailForm] = useState(EMPTY_AVAIL)
	const [availEditId, setAvailEditId] = useState(null)

	useEffect(() => {
		loadAll()
	}, [])

	const loadAll = async () => {
		try {
			const [teachersData, subjectsData] = await Promise.all([
				scheduleService.getTeachers(),
				scheduleService.getSubjects(),
			])
			setTeachers(teachersData)
			setAllSubjects(subjectsData)
		} catch {
			toast.error('Ошибка загрузки данных')
		} finally {
			setLoading(false)
		}
	}

	// ── Edit handlers ──────────────────────────────────
	const openCreate = () => {
		setForm(EMPTY_TEACHER)
		setEditDialog({ open: true, item: null })
	}

	const openEdit = item => {
		setForm({
			full_name: item.full_name,
			phone: item.phone || '',
			is_active: item.is_active,
			notes: item.notes || '',
		})
		setEditDialog({ open: true, item })
	}

	const closeEdit = () => setEditDialog({ open: false, item: null })

	const saveTeacher = async () => {
		if (!form.full_name.trim()) {
			toast.error('Введите ФИО преподавателя')
			return
		}
		try {
			const data = {
				full_name: form.full_name.trim(),
				phone: form.phone || null,
				is_active: form.is_active,
				notes: form.notes || null,
			}
			if (editDialog.item) {
				await scheduleService.updateTeacher(editDialog.item.id, data)
				toast.success('Преподаватель обновлён')
			} else {
				await scheduleService.createTeacher(data)
				toast.success('Преподаватель создан')
			}
			closeEdit()
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const deactivateTeacher = async id => {
		if (!window.confirm('Деактивировать преподавателя?')) return
		try {
			await scheduleService.deactivateTeacher(id)
			toast.success('Преподаватель деактивирован')
			loadAll()
		} catch {
			toast.error('Ошибка деактивации')
		}
	}

	const removeTeacher = async id => {
		if (!window.confirm('Удалить преподавателя безвозвратно?')) return
		try {
			await scheduleService.deleteTeacher(id)
			toast.success('Преподаватель удалён')
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления')
		}
	}

	// ── Subjects handlers ──────────────────────────────
	const openSubjects = async teacher => {
		try {
			const data = await scheduleService.getTeacherSubjects(teacher.id)
			setSelectedSubjectIds(data.map(ts => ts.subject_id))
			setSubjectsDialog({ open: true, teacher })
		} catch {
			toast.error('Ошибка загрузки предметов')
		}
	}

	const closeSubjects = () => setSubjectsDialog({ open: false, teacher: null })

	const saveSubjects = async () => {
		try {
			await scheduleService.updateTeacherSubjects(
				subjectsDialog.teacher.id,
				selectedSubjectIds,
			)
			toast.success('Предметы преподавателя обновлены')
			closeSubjects()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	// ── Availability handlers ──────────────────────────
	const openAvail = async teacher => {
		try {
			const data = await scheduleService.getTeacherAvailability(teacher.id)
			setAvailList(data)
			setAvailForm(EMPTY_AVAIL)
			setAvailEditId(null)
			setAvailDialog({ open: true, teacher })
		} catch {
			toast.error('Ошибка загрузки рабочего времени')
		}
	}

	const closeAvail = () => {
		setAvailDialog({ open: false, teacher: null })
		setAvailEditId(null)
	}

	const reloadAvail = async () => {
		const data = await scheduleService.getTeacherAvailability(
			availDialog.teacher.id,
		)
		setAvailList(data)
	}

	const saveAvail = async () => {
		try {
			if (availEditId) {
				await scheduleService.updateTeacherAvailability(
					availDialog.teacher.id,
					availEditId,
					availForm,
				)
				toast.success('Окно обновлено')
			} else {
				await scheduleService.createTeacherAvailability(
					availDialog.teacher.id,
					availForm,
				)
				toast.success('Окно добавлено')
			}
			await reloadAvail()
			setAvailForm(EMPTY_AVAIL)
			setAvailEditId(null)
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const editAvailItem = item => {
		setAvailForm({
			weekday: item.weekday,
			start_time: item.start_time,
			end_time: item.end_time,
		})
		setAvailEditId(item.id)
	}

	const deleteAvailItem = async availId => {
		if (!window.confirm('Удалить окно?')) return
		try {
			await scheduleService.deleteTeacherAvailability(
				availDialog.teacher.id,
				availId,
			)
			toast.success('Окно удалено')
			await reloadAvail()
		} catch {
			toast.error('Ошибка удаления')
		}
	}

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={3}
				>
					<Typography variant='h4'>Преподаватели</Typography>
					<Box display='flex' gap={2}>
						<Button
							variant='contained'
							startIcon={<AddIcon />}
							onClick={openCreate}
						>
							Добавить
						</Button>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/admin/schedule')}
						>
							Назад
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
									<TableCell>ФИО</TableCell>
									<TableCell>Телефон</TableCell>
									<TableCell>Статус</TableCell>
									<TableCell align='center'>Действия</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{teachers.map(t => (
									<TableRow key={t.id}>
										<TableCell>{t.id}</TableCell>
										<TableCell>{t.full_name}</TableCell>
										<TableCell>{t.phone || '—'}</TableCell>
										<TableCell>
											<Chip
												label={t.is_active ? 'Активен' : 'Неактивен'}
												color={t.is_active ? 'success' : 'default'}
												size='small'
											/>
										</TableCell>
										<TableCell align='center'>
											<IconButton
												onClick={() => openEdit(t)}
												size='small'
												title='Редактировать'
											>
												<EditIcon />
											</IconButton>
											<IconButton
												onClick={() => openSubjects(t)}
												size='small'
												color='primary'
												title='Предметы'
											>
												<SubjectsIcon />
											</IconButton>
											<IconButton
												onClick={() => openAvail(t)}
												size='small'
												color='secondary'
												title='Рабочее время'
											>
												<AvailIcon />
											</IconButton>
											<IconButton
												onClick={() => deactivateTeacher(t.id)}
												size='small'
												color='warning'
												title='Деактивировать'
											>
												<DeactivateIcon />
											</IconButton>
											<IconButton
												onClick={() => removeTeacher(t.id)}
												size='small'
												color='error'
												title='Удалить'
											>
												<DeleteIcon />
											</IconButton>
										</TableCell>
									</TableRow>
								))}
								{!teachers.length && (
									<TableRow>
										<TableCell colSpan={5} align='center'>
											<Typography color='text.secondary'>
												Преподаватели не найдены
											</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</Paper>

			{/* Edit Dialog */}
			<Dialog
				open={editDialog.open}
				onClose={closeEdit}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>
					{editDialog.item
						? 'Редактировать преподавателя'
						: 'Новый преподаватель'}
				</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<TextField
							label='ФИО'
							value={form.full_name}
							onChange={e => setForm({ ...form, full_name: e.target.value })}
							fullWidth
							required
						/>
						<TextField
							label='Телефон'
							value={form.phone}
							onChange={e => setForm({ ...form, phone: e.target.value })}
							fullWidth
						/>
						<TextField
							label='Примечания'
							value={form.notes}
							onChange={e => setForm({ ...form, notes: e.target.value })}
							fullWidth
							multiline
							rows={2}
						/>
						<FormControlLabel
							control={
								<Switch
									checked={form.is_active}
									onChange={e =>
										setForm({ ...form, is_active: e.target.checked })
									}
								/>
							}
							label='Активен'
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeEdit}>Отмена</Button>
					<Button onClick={saveTeacher} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Subjects Dialog */}
			<Dialog
				open={subjectsDialog.open}
				onClose={closeSubjects}
				maxWidth='sm'
				fullWidth
			>
				<DialogTitle>Предметы: {subjectsDialog.teacher?.full_name}</DialogTitle>
				<DialogContent>
					<Box sx={{ mt: 1 }}>
						<Typography variant='body2' color='text.secondary' gutterBottom>
							Выберите предметы, которые ведёт этот преподаватель:
						</Typography>
						<FormControl fullWidth sx={{ mt: 1 }}>
							<InputLabel>Предметы</InputLabel>
							<Select
								multiple
								value={selectedSubjectIds}
								onChange={e => setSelectedSubjectIds(e.target.value)}
								input={<OutlinedInput label='Предметы' />}
								renderValue={selected => (
									<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
										{selected.map(id => (
											<Chip
												key={id}
												label={allSubjects.find(s => s.id === id)?.name || id}
												size='small'
											/>
										))}
									</Box>
								)}
							>
								{allSubjects
									.filter(s => s.is_active)
									.map(s => (
										<MenuItem key={s.id} value={s.id}>
											<Checkbox checked={selectedSubjectIds.includes(s.id)} />
											<ListItemText primary={s.name} />
										</MenuItem>
									))}
							</Select>
						</FormControl>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeSubjects}>Отмена</Button>
					<Button onClick={saveSubjects} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Availability Dialog */}
			<Dialog
				open={availDialog.open}
				onClose={closeAvail}
				maxWidth='md'
				fullWidth
			>
				<DialogTitle>
					Рабочее время: {availDialog.teacher?.full_name}
				</DialogTitle>
				<DialogContent>
					<Box sx={{ mt: 1 }}>
						{availList.length > 0 ? (
							<Table size='small' sx={{ mb: 2 }}>
								<TableHead>
									<TableRow>
										<TableCell>День недели</TableCell>
										<TableCell>Начало</TableCell>
										<TableCell>Конец</TableCell>
										<TableCell align='center'>Действия</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{availList.map(a => (
										<TableRow key={a.id} selected={availEditId === a.id}>
											<TableCell>{WEEKDAY_FULL[a.weekday]}</TableCell>
											<TableCell>{a.start_time}</TableCell>
											<TableCell>{a.end_time}</TableCell>
											<TableCell align='center'>
												<IconButton
													size='small'
													onClick={() => editAvailItem(a)}
													title='Редактировать'
												>
													<EditIcon fontSize='small' />
												</IconButton>
												<IconButton
													size='small'
													color='error'
													onClick={() => deleteAvailItem(a.id)}
													title='Удалить'
												>
													<DeleteIcon fontSize='small' />
												</IconButton>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<Typography color='text.secondary' sx={{ mb: 2 }}>
								Рабочее время не задано
							</Typography>
						)}

						<Divider sx={{ mb: 2 }} />
						<Typography variant='subtitle2' gutterBottom>
							{availEditId ? 'Редактировать окно' : 'Добавить окно'}
						</Typography>

						<Box display='flex' gap={2} alignItems='flex-end' flexWrap='wrap'>
							<FormControl sx={{ minWidth: 160 }}>
								<InputLabel>День недели</InputLabel>
								<Select
									value={availForm.weekday}
									label='День недели'
									onChange={e =>
										setAvailForm({ ...availForm, weekday: e.target.value })
									}
									size='small'
								>
									{Object.entries(WEEKDAY_FULL).map(([k, v]) => (
										<MenuItem key={k} value={Number(k)}>
											{v}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<TextField
								label='Начало (ЧЧ:ММ)'
								value={availForm.start_time}
								onChange={e =>
									setAvailForm({ ...availForm, start_time: e.target.value })
								}
								size='small'
								sx={{ width: 150 }}
								placeholder='09:00'
							/>
							<TextField
								label='Конец (ЧЧ:ММ)'
								value={availForm.end_time}
								onChange={e =>
									setAvailForm({ ...availForm, end_time: e.target.value })
								}
								size='small'
								sx={{ width: 150 }}
								placeholder='18:00'
							/>
							<Button variant='contained' size='small' onClick={saveAvail}>
								{availEditId ? 'Обновить' : 'Добавить'}
							</Button>
							{availEditId && (
								<Button
									size='small'
									onClick={() => {
										setAvailForm(EMPTY_AVAIL)
										setAvailEditId(null)
									}}
								>
									Отмена
								</Button>
							)}
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeAvail}>Закрыть</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminTeachers
