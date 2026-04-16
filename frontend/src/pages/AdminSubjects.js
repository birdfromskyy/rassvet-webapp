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
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Switch,
	FormControlLabel,
	Chip,
	CircularProgress,
} from '@mui/material'
import {
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	Block as DeactivateIcon,
	ArrowBack as BackIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import scheduleService from '../services/scheduleService'

const EMPTY = { name: '', default_duration_min: 50, is_active: true }

const AdminSubjects = () => {
	const navigate = useNavigate()
	const [subjects, setSubjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [dialog, setDialog] = useState({ open: false, item: null })
	const [form, setForm] = useState(EMPTY)

	useEffect(() => {
		load()
	}, [])

	const load = async () => {
		try {
			setSubjects(await scheduleService.getSubjects())
		} catch {
			toast.error('Ошибка загрузки предметов')
		} finally {
			setLoading(false)
		}
	}

	const openCreate = () => {
		setForm(EMPTY)
		setDialog({ open: true, item: null })
	}

	const openEdit = item => {
		setForm({
			name: item.name,
			default_duration_min: item.default_duration_min,
			is_active: item.is_active,
		})
		setDialog({ open: true, item })
	}

	const close = () => setDialog({ open: false, item: null })

	const save = async () => {
		if (!form.name.trim()) {
			toast.error('Введите название предмета')
			return
		}
		try {
			if (dialog.item) {
				await scheduleService.updateSubject(dialog.item.id, form)
				toast.success('Предмет обновлён')
			} else {
				await scheduleService.createSubject(form)
				toast.success('Предмет создан')
			}
			close()
			load()
		} catch (e) {
			toast.error(e.response?.data?.error || 'Ошибка сохранения')
		}
	}

	const deactivate = async id => {
		if (!window.confirm('Деактивировать предмет?')) return
		try {
			await scheduleService.deactivateSubject(id)
			toast.success('Предмет деактивирован')
			load()
		} catch {
			toast.error('Ошибка деактивации')
		}
	}

	const remove = async id => {
		if (!window.confirm('Удалить предмет безвозвратно?')) return
		try {
			await scheduleService.deleteSubject(id)
			toast.success('Предмет удалён')
			load()
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
					<Typography variant='h4'>Предметы</Typography>
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
									<TableCell>Длительность</TableCell>
									<TableCell>Статус</TableCell>
									<TableCell align='center'>Действия</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{subjects.map(s => (
									<TableRow key={s.id}>
										<TableCell>{s.id}</TableCell>
										<TableCell>{s.name}</TableCell>
										<TableCell>{s.default_duration_min} мин</TableCell>
										<TableCell>
											<Chip
												label={s.is_active ? 'Активен' : 'Неактивен'}
												color={s.is_active ? 'success' : 'default'}
												size='small'
											/>
										</TableCell>
										<TableCell align='center'>
											<IconButton
												onClick={() => openEdit(s)}
												size='small'
												title='Редактировать'
											>
												<EditIcon />
											</IconButton>
											<IconButton
												onClick={() => deactivate(s.id)}
												color='warning'
												size='small'
												title='Деактивировать'
											>
												<DeactivateIcon />
											</IconButton>
											<IconButton
												onClick={() => remove(s.id)}
												color='error'
												size='small'
												title='Удалить'
											>
												<DeleteIcon />
											</IconButton>
										</TableCell>
									</TableRow>
								))}
								{!subjects.length && (
									<TableRow>
										<TableCell colSpan={5} align='center'>
											<Typography color='text.secondary'>
												Предметы не найдены
											</Typography>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</Paper>

			<Dialog open={dialog.open} onClose={close} maxWidth='sm' fullWidth>
				<DialogTitle>
					{dialog.item ? 'Редактировать предмет' : 'Новый предмет'}
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
						<FormControl fullWidth>
							<InputLabel>Длительность занятия</InputLabel>
							<Select
								value={form.default_duration_min}
								label='Длительность занятия'
								onChange={e =>
									setForm({ ...form, default_duration_min: e.target.value })
								}
							>
								<MenuItem value={30}>30 минут</MenuItem>
								<MenuItem value={50}>50 минут</MenuItem>
							</Select>
						</FormControl>
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
					<Button onClick={close}>Отмена</Button>
					<Button onClick={save} variant='contained'>
						Сохранить
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
}

export default AdminSubjects
