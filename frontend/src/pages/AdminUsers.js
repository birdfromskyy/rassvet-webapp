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
	Chip,
	CircularProgress,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Divider,
	Tooltip,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	TextField,
	Badge,
	Autocomplete,
} from '@mui/material'
import {
	ArrowBack as BackIcon,
	ChildCare as ChildIcon,
	Delete as DeleteIcon,
	Add as AddIcon,
	PersonAdd as PersonAddIcon,
	Edit as EditIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const EMPTY_FORM = {
	email: '',
	password: '',
	first_name: '',
	last_name: '',
	middle_name: '',
	role: 'user',
}

const UserFormFields = ({ form, setForm, isEdit }) => (
	<Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
		<TextField
			label='Email *'
			value={form.email}
			onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
			fullWidth
			size='small'
			type='email'
		/>
		<TextField
			label={isEdit ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}
			value={form.password}
			onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
			fullWidth
			size='small'
			type='password'
		/>
		<TextField
			label='Фамилия *'
			value={form.last_name}
			onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
			fullWidth
			size='small'
		/>
		<TextField
			label='Имя *'
			value={form.first_name}
			onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
			fullWidth
			size='small'
		/>
		<TextField
			label='Отчество'
			value={form.middle_name}
			onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))}
			fullWidth
			size='small'
		/>
		<FormControl fullWidth size='small'>
			<InputLabel>Роль</InputLabel>
			<Select
				value={form.role}
				label='Роль'
				onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
			>
				<MenuItem value='user'>Пользователь</MenuItem>
				<MenuItem value='admin'>Администратор</MenuItem>
			</Select>
		</FormControl>
	</Box>
)

const AdminUsers = () => {
	const navigate = useNavigate()
	const [users, setUsers] = useState([])
	const [students, setStudents] = useState([])
	const [loading, setLoading] = useState(true)
	const [childrenCounts, setChildrenCounts] = useState({})

	const [childDialog, setChildDialog] = useState({ open: false, user: null })
	const [children, setChildren] = useState([])
	const [selectedStudent, setSelectedStudent] = useState(null)

	const [createDialog, setCreateDialog] = useState(false)
	const [createForm, setCreateForm] = useState(EMPTY_FORM)
	const [createLoading, setCreateLoading] = useState(false)

	const [editDialog, setEditDialog] = useState({ open: false, user: null })
	const [editForm, setEditForm] = useState(EMPTY_FORM)
	const [editLoading, setEditLoading] = useState(false)

	useEffect(() => {
		loadAll()
	}, [])

	const loadAll = async () => {
		try {
			const [usersData, studentsData] = await Promise.all([
				scheduleService.getUsers(),
				scheduleService.getStudents(),
			])
			setUsers(usersData)
			setStudents(studentsData)

			const counts = {}
			await Promise.allSettled(
				usersData.map(u =>
					scheduleService.getUserChildren(u.id).then(ch => {
						counts[u.id] = ch.length
					})
				)
			)
			setChildrenCounts(counts)
		} catch {
			toast.error('Ошибка загрузки данных')
		} finally {
			setLoading(false)
		}
	}

	const openChildDialog = async user => {
		try {
			const data = await scheduleService.getUserChildren(user.id)
			setChildren(data)
			setSelectedStudent(null)
			setChildDialog({ open: true, user })
		} catch {
			toast.error('Ошибка загрузки детей')
		}
	}

	const closeChildDialog = () => {
		setChildDialog({ open: false, user: null })
		setChildren([])
		setSelectedStudent(null)
	}

	const addChild = async () => {
		if (!selectedStudent) return
		try {
			await scheduleService.addUserChild(childDialog.user.id, selectedStudent.id)
			toast.success('Ученик привязан')
			const data = await scheduleService.getUserChildren(childDialog.user.id)
			setChildren(data)
			setChildrenCounts(prev => ({ ...prev, [childDialog.user.id]: data.length }))
			setSelectedStudent(null)
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка привязки')
		}
	}

	const removeChild = async studentId => {
		if (!window.confirm('Отвязать ученика от пользователя?')) return
		try {
			await scheduleService.removeUserChild(childDialog.user.id, studentId)
			toast.success('Ученик отвязан')
			const data = await scheduleService.getUserChildren(childDialog.user.id)
			setChildren(data)
			setChildrenCounts(prev => ({ ...prev, [childDialog.user.id]: data.length }))
		} catch {
			toast.error('Ошибка удаления')
		}
	}

	const handleCreate = async () => {
		if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.last_name) {
			toast.error('Заполните обязательные поля')
			return
		}
		setCreateLoading(true)
		try {
			await scheduleService.createUser(createForm)
			toast.success('Пользователь создан')
			setCreateDialog(false)
			setCreateForm(EMPTY_FORM)
			setLoading(true)
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка создания пользователя')
		} finally {
			setCreateLoading(false)
		}
	}

	const openEditDialog = user => {
		setEditForm({
			email: user.email || '',
			password: '',
			first_name: user.first_name || '',
			last_name: user.last_name || '',
			middle_name: user.middle_name || '',
			role: user.role || 'user',
		})
		setEditDialog({ open: true, user })
	}

	const handleEdit = async () => {
		if (!editForm.email || !editForm.first_name || !editForm.last_name) {
			toast.error('Заполните обязательные поля')
			return
		}
		setEditLoading(true)
		try {
			await scheduleService.updateUser(editDialog.user.id, editForm)
			toast.success('Данные пользователя обновлены')
			setEditDialog({ open: false, user: null })
			setLoading(true)
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка обновления пользователя')
		} finally {
			setEditLoading(false)
		}
	}

	const linkedStudentIds = children.map(c => c.student_id)
	const availableStudents = students.filter(s => !linkedStudentIds.includes(s.id))

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
					<Typography variant='h4'>Пользователи</Typography>
					<Box display='flex' gap={2}>
						<Button
							variant='contained'
							startIcon={<PersonAddIcon />}
							onClick={() => { setCreateForm(EMPTY_FORM); setCreateDialog(true) }}
						>
							Создать пользователя
						</Button>
						<Button startIcon={<BackIcon />} onClick={() => navigate('/admin/schedule')}>
							Назад
						</Button>
					</Box>
				</Box>

				<Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
					Привяжите учеников к учётным записям родителей — они смогут видеть расписание своего ребёнка
					после его публикации.
				</Typography>

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
									<TableCell>Email</TableCell>
									<TableCell>ФИО</TableCell>
									<TableCell>Роль</TableCell>
									<TableCell align='center'>Дети</TableCell>
									<TableCell align='center'>Действия</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{users.map(u => (
									<TableRow key={u.id}>
										<TableCell>{u.id}</TableCell>
										<TableCell>{u.email}</TableCell>
										<TableCell>
											{[u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ') || '—'}
										</TableCell>
										<TableCell>
											<Chip
												label={u.role === 'admin' ? 'Администратор' : 'Пользователь'}
												color={u.role === 'admin' ? 'error' : 'default'}
												size='small'
											/>
										</TableCell>
										<TableCell align='center'>
											{(childrenCounts[u.id] || 0) > 0 ? (
												<Chip
													label={childrenCounts[u.id]}
													color='success'
													size='small'
													icon={<ChildIcon />}
												/>
											) : (
												<Typography variant='caption' color='text.disabled'>—</Typography>
											)}
										</TableCell>
										<TableCell align='center'>
											<Tooltip title='Редактировать пользователя'>
												<IconButton size='small' onClick={() => openEditDialog(u)}>
													<EditIcon fontSize='small' />
												</IconButton>
											</Tooltip>
											<Tooltip title='Управление детьми'>
												<IconButton
													size='small'
													color='primary'
													onClick={() => openChildDialog(u)}
												>
													<Badge
														badgeContent={childrenCounts[u.id] || 0}
														color='success'
														invisible={(childrenCounts[u.id] || 0) === 0}
													>
														<ChildIcon />
													</Badge>
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
								{!users.length && (
									<TableRow>
										<TableCell colSpan={6} align='center'>
											<Typography color='text.secondary'>Пользователи не найдены</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</Paper>

			{/* Children Dialog */}
			<Dialog open={childDialog.open} onClose={closeChildDialog} maxWidth='sm' fullWidth>
				<DialogTitle>
					Дети пользователя: {childDialog.user?.first_name} {childDialog.user?.last_name}
				</DialogTitle>
				<DialogContent>
					<Box sx={{ mt: 1 }}>
						{children.length > 0 ? (
							<List dense>
								{children.map(link => (
									<ListItem key={link.id} divider>
										<ListItemText
											primary={link.student?.full_name || `Ученик #${link.student_id}`}
											secondary={link.student?.is_active ? 'Активен' : 'Неактивен'}
										/>
										<ListItemSecondaryAction>
											<IconButton
												edge='end'
												color='error'
												size='small'
												onClick={() => removeChild(link.student_id)}
											>
												<DeleteIcon fontSize='small' />
											</IconButton>
										</ListItemSecondaryAction>
									</ListItem>
								))}
							</List>
						) : (
							<Typography color='text.secondary' sx={{ mb: 2 }}>
								Дети не привязаны
							</Typography>
						)}

						<Divider sx={{ my: 2 }} />
						<Typography variant='subtitle2' gutterBottom>
							Привязать ученика
						</Typography>
						<Box display='flex' gap={2} alignItems='center'>
							<Autocomplete
								fullWidth
								size='small'
								options={availableStudents}
								getOptionLabel={s => s.full_name + (s.is_active ? '' : ' (неактивен)')}
								value={selectedStudent}
								onChange={(_, val) => setSelectedStudent(val)}
								noOptionsText={
									availableStudents.length === 0
										? 'Все ученики уже привязаны'
										: 'Ничего не найдено'
								}
								renderInput={params => (
									<TextField {...params} label='Поиск ученика' />
								)}
							/>
							<Button
								variant='contained'
								startIcon={<AddIcon />}
								onClick={addChild}
								disabled={!selectedStudent}
								sx={{ whiteSpace: 'nowrap' }}
							>
								Добавить
							</Button>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeChildDialog}>Закрыть</Button>
				</DialogActions>
			</Dialog>

			{/* Create User Dialog */}
			<Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth='sm' fullWidth>
				<DialogTitle>Создать пользователя</DialogTitle>
				<DialogContent>
					<UserFormFields form={createForm} setForm={setCreateForm} isEdit={false} />
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setCreateDialog(false)}>Отмена</Button>
					<Button variant='contained' onClick={handleCreate} disabled={createLoading}>
						{createLoading ? 'Создание...' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Edit User Dialog */}
			<Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, user: null })} maxWidth='sm' fullWidth>
				<DialogTitle>
					Редактировать пользователя #{editDialog.user?.id}
				</DialogTitle>
				<DialogContent>
					<UserFormFields form={editForm} setForm={setEditForm} isEdit={true} />
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setEditDialog({ open: false, user: null })}>Отмена</Button>
					<Button variant='contained' onClick={handleEdit} disabled={editLoading}>
						{editLoading ? 'Сохранение...' : 'Сохранить'}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminUsers
