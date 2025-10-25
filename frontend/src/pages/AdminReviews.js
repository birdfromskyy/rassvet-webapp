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
	Rating,
	Chip,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
} from '@mui/material'
import {
	Edit as EditIcon,
	Delete as DeleteIcon,
	Visibility as ViewIcon,
	ArrowBack as BackIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import reviewService from '../services/reviewService'

const AdminReviews = () => {
	const navigate = useNavigate()
	const [reviews, setReviews] = useState([])
	const [loading, setLoading] = useState(true)
	const [statusFilter, setStatusFilter] = useState('')
	const [editDialog, setEditDialog] = useState({ open: false, review: null })
	const [viewDialog, setViewDialog] = useState({ open: false, review: null })
	const [editData, setEditData] = useState({ content: '', rating: 5 })

	useEffect(() => {
		fetchReviews()
	}, [statusFilter])

	const fetchReviews = async () => {
		try {
			const data = await reviewService.getAllReviews(statusFilter)
			setReviews(data)
		} catch (error) {
			toast.error('Ошибка загрузки отзывов')
		} finally {
			setLoading(false)
		}
	}

	const handleEdit = review => {
		setEditData({ content: review.content, rating: review.rating })
		setEditDialog({ open: true, review })
	}

	const handleSaveEdit = async () => {
		try {
			await reviewService.updateReview(editDialog.review.id, editData)
			toast.success('Отзыв обновлен')
			setEditDialog({ open: false, review: null })
			fetchReviews()
		} catch (error) {
			toast.error('Ошибка обновления отзыва')
		}
	}

	const handleDelete = async id => {
		if (window.confirm('Удалить этот отзыв?')) {
			try {
				await reviewService.deleteReview(id)
				toast.success('Отзыв удален')
				fetchReviews()
			} catch (error) {
				toast.error('Ошибка удаления отзыва')
			}
		}
	}

	const getStatusColor = status => {
		switch (status) {
			case 'approved':
				return 'success'
			case 'pending':
				return 'warning'
			case 'rejected':
				return 'error'
			default:
				return 'default'
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
					<Typography variant='h4'>Управление отзывами</Typography>
					<Box display='flex' gap={2}>
						<FormControl size='small' sx={{ minWidth: 150 }}>
							<InputLabel>Статус</InputLabel>
							<Select
								value={statusFilter}
								label='Статус'
								onChange={e => setStatusFilter(e.target.value)}
							>
								<MenuItem value=''>Все</MenuItem>
								<MenuItem value='pending'>На модерации</MenuItem>
								<MenuItem value='approved'>Одобренные</MenuItem>
								<MenuItem value='rejected'>Отклоненные</MenuItem>
							</Select>
						</FormControl>
						<Button
							variant='outlined'
							onClick={() => navigate('/admin/pending-reviews')}
						>
							Модерация
						</Button>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/dashboard')}
						>
							На главную
						</Button>
					</Box>
				</Box>

				<TableContainer>
					<Table>
						<TableHead>
							<TableRow>
								<TableCell>ID</TableCell>
								<TableCell>Автор</TableCell>
								<TableCell>Оценка</TableCell>
								<TableCell>Статус</TableCell>
								<TableCell>Дата</TableCell>
								<TableCell align='center'>Действия</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{reviews.map(review => (
								<TableRow key={review.id}>
									<TableCell>{review.id}</TableCell>
									<TableCell>
										{review.is_anonymous
											? 'Анонимный'
											: `${review.user?.first_name} ${review.user?.last_name?.[0]}.`}
									</TableCell>
									<TableCell>
										<Rating value={review.rating} readOnly size='small' />
									</TableCell>
									<TableCell>
										<Chip
											label={review.status}
											color={getStatusColor(review.status)}
											size='small'
										/>
									</TableCell>
									<TableCell>
										{new Date(review.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell align='center'>
										<IconButton
											onClick={() => setViewDialog({ open: true, review })}
										>
											<ViewIcon />
										</IconButton>
										<IconButton onClick={() => handleEdit(review)}>
											<EditIcon />
										</IconButton>
										<IconButton
											onClick={() => handleDelete(review.id)}
											color='error'
										>
											<DeleteIcon />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>

				{/* View Dialog */}
				<Dialog
					open={viewDialog.open}
					onClose={() => setViewDialog({ open: false, review: null })}
					maxWidth='sm'
					fullWidth
				>
					<DialogTitle>Просмотр отзыва</DialogTitle>
					<DialogContent>
						{viewDialog.review && (
							<Box>
								<Typography variant='body2' color='text.secondary' gutterBottom>
									Автор:{' '}
									{viewDialog.review.is_anonymous
										? 'Анонимный'
										: `${viewDialog.review.user?.first_name} ${viewDialog.review.user?.last_name}`}
								</Typography>
								<Rating
									value={viewDialog.review.rating}
									readOnly
									sx={{ my: 2 }}
								/>
								<Typography variant='body1'>
									{viewDialog.review.content}
								</Typography>
							</Box>
						)}
					</DialogContent>
					<DialogActions>
						<Button
							onClick={() => setViewDialog({ open: false, review: null })}
						>
							Закрыть
						</Button>
					</DialogActions>
				</Dialog>

				{/* Edit Dialog */}
				<Dialog
					open={editDialog.open}
					onClose={() => setEditDialog({ open: false, review: null })}
					maxWidth='sm'
					fullWidth
				>
					<DialogTitle>Редактировать отзыв</DialogTitle>
					<DialogContent>
						<Box sx={{ pt: 2 }}>
							<Typography component='legend' gutterBottom>
								Оценка
							</Typography>
							<Rating
								value={editData.rating}
								onChange={(event, newValue) =>
									setEditData({ ...editData, rating: newValue })
								}
								sx={{ mb: 2 }}
							/>
							<TextField
								fullWidth
								multiline
								rows={4}
								label='Текст отзыва'
								value={editData.content}
								onChange={e =>
									setEditData({ ...editData, content: e.target.value })
								}
							/>
						</Box>
					</DialogContent>
					<DialogActions>
						<Button
							onClick={() => setEditDialog({ open: false, review: null })}
						>
							Отмена
						</Button>
						<Button onClick={handleSaveEdit} variant='contained'>
							Сохранить
						</Button>
					</DialogActions>
				</Dialog>
			</Paper>
		</Container>
	)
}

export default AdminReviews
