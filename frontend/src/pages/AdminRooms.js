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
	Tooltip,
} from '@mui/material'
import {
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	ArrowBack as BackIcon,
	School as SubjectsIcon,
	Pause as PauseIcon,
	PlayArrow as PlayIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const EMPTY_ROOM = { name: '', is_active: true }

const AdminRooms = () => {
	const navigate = useNavigate()
	const [rooms, setRooms] = useState([])
	const [allSubjects, setAllSubjects] = useState([])
	const [loading, setLoading] = useState(true)

	const [editDialog, setEditDialog] = useState({ open: false, item: null })
	const [form, setForm] = useState(EMPTY_ROOM)

	const [subjectsDialog, setSubjectsDialog] = useState({
		open: false,
		room: null,
	})
	const [selectedSubjectIds, setSelectedSubjectIds] = useState([])

	useEffect(() => {
		loadAll()
	}, [])

	const loadAll = async () => {
		try {
			const [roomsData, subjectsData] = await Promise.all([
				scheduleService.getRooms(),
				scheduleService.getSubjects(),
			])
			setRooms(roomsData)
			setAllSubjects(subjectsData)
		} catch {
			toast.error('Ошибка загрузки данных')
		} finally {
			setLoading(false)
		}
	}

	const openCreate = () => {
		setForm(EMPTY_ROOM)
		setEditDialog({ open: true, item: null })
	}

	const openEdit = item => {
		setForm({
			name: item.name,
			is_active: item.is_active,
		})
		setEditDialog({ open: true, item })
	}

	const closeEdit = () => setEditDialog({ open: false, item: null })

	const openSubjects = async room => {
		try {
			const data = await scheduleService.getRoomSubjects(room.id)
			setSelectedSubjectIds(data.map(rs => rs.subject_id))
			setSubjectsDialog({ open: true, room })
		} catch {
			toast.error('Ошибка загрузки предметов кабинета')
		}
	}

	const closeSubjects = () => setSubjectsDialog({ open: false, room: null })

	const saveRoom = async () => {
		if (!form.name.trim()) {
			toast.error('Введите название кабинета')
			return
		}
		try {
			const data = {
				name: form.name.trim(),
				is_active: form.is_active,
			}
			if (editDialog.item) {
				await scheduleService.updateRoom(editDialog.item.id, data)
				toast.success('Кабинет обновлён')
			} else {
				await scheduleService.createRoom(data)
				toast.success('Кабинет создан')
			}
			closeEdit()
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const saveSubjects = async () => {
		try {
			await scheduleService.updateRoomSubjects(
				subjectsDialog.room.id,
				selectedSubjectIds,
			)
			toast.success('Предметы кабинета обновлены')
			closeSubjects()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения предметов')
		}
	}

	const toggleRoomActive = async room => {
		try {
			if (room.is_active) {
				await scheduleService.deactivateRoom(room.id)
				toast.success('Кабинет деактивирован')
			} else {
				await scheduleService.updateRoom(room.id, { is_active: true })
				toast.success('Кабинет активирован')
			}
			loadAll()
		} catch {
			toast.error('Ошибка изменения статуса')
		}
	}

	const removeRoom = async id => {
		if (!window.confirm('Удалить кабинет безвозвратно?')) return
		try {
			await scheduleService.deleteRoom(id)
			toast.success('Кабинет удалён')
			loadAll()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка удаления')
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
					<Typography variant='h4'>Кабинеты</Typography>
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
									<TableCell>Название</TableCell>
									<TableCell>Статус</TableCell>
									<TableCell align='center'>Действия</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{rooms.map(r => (
									<TableRow key={r.id}>
										<TableCell>{r.id}</TableCell>
										<TableCell>{r.name}</TableCell>
										<TableCell>
											<Chip
												label={r.is_active ? 'Активен' : 'Неактивен'}
												color={r.is_active ? 'success' : 'default'}
												size='small'
											/>
										</TableCell>
										<TableCell align='center'>
											<IconButton
												onClick={() => openEdit(r)}
												size='small'
												title='Редактировать'
											>
												<EditIcon />
											</IconButton>
											<IconButton
												onClick={() => openSubjects(r)}
												size='small'
												color='primary'
												title='Предметы кабинета'
											>
												<SubjectsIcon />
											</IconButton>
											<Tooltip title={r.is_active ? 'Деактивировать' : 'Активировать'}>
												<IconButton
													onClick={() => toggleRoomActive(r)}
													size='small'
													color={r.is_active ? 'warning' : 'success'}
												>
													{r.is_active ? <PauseIcon /> : <PlayIcon />}
												</IconButton>
											</Tooltip>
											<IconButton
												onClick={() => removeRoom(r.id)}
												size='small'
												color='error'
												title='Удалить'
											>
												<DeleteIcon />
											</IconButton>
										</TableCell>
									</TableRow>
								))}
								{!rooms.length && (
									<TableRow>
										<TableCell colSpan={4} align='center'>
											<Typography color='text.secondary'>
												Кабинеты не найдены
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
					{editDialog.item ? 'Редактировать кабинет' : 'Новый кабинет'}
				</DialogTitle>
				<DialogContent>
					<Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
						<TextField
							label='Название'
							value={form.name}
							onChange={e => setForm({ ...form, name: e.target.value })}
							fullWidth
							required
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
					<Button onClick={saveRoom} variant='contained'>
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
				<DialogTitle>
					Предметы кабинета: {subjectsDialog.room?.name}
				</DialogTitle>
				<DialogContent>
					<Box sx={{ mt: 1 }}>
						<Typography variant='body2' color='text.secondary' gutterBottom>
							Выберите предметы, которые можно проводить в этом кабинете:
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
		</Container>
	)
}

export default AdminRooms
