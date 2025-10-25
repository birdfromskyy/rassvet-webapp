import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Card,
	CardContent,
	CardActions,
	Rating,
	Grid,
	Alert,
	CircularProgress,
} from '@mui/material'
import {
	Check as ApproveIcon,
	Close as RejectIcon,
	ArrowBack as BackIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import reviewService from '../services/reviewService'

const PendingReviews = () => {
	const navigate = useNavigate()
	const [reviews, setReviews] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetchPendingReviews()
	}, [])

	const fetchPendingReviews = async () => {
		try {
			const data = await reviewService.getPendingReviews()
			setReviews(data)
		} catch (error) {
			toast.error('Ошибка загрузки отзывов на модерации')
		} finally {
			setLoading(false)
		}
	}

	const handleApprove = async id => {
		try {
			await reviewService.approveReview(id)
			toast.success('Отзыв одобрен')
			setReviews(reviews.filter(r => r.id !== id))
		} catch (error) {
			toast.error('Ошибка одобрения отзыва')
		}
	}

	const handleReject = async id => {
		try {
			await reviewService.rejectReview(id)
			toast.success('Отзыв отклонен')
			setReviews(reviews.filter(r => r.id !== id))
		} catch (error) {
			toast.error('Ошибка отклонения отзыва')
		}
	}

	if (loading) {
		return (
			<Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
				<CircularProgress />
			</Container>
		)
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
					<Typography variant='h4'>Отзывы на модерации</Typography>
					<Box>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/admin/reviews')}
							sx={{ mr: 2 }}
						>
							Все отзывы
						</Button>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/dashboard')}
						>
							На главную
						</Button>
					</Box>
				</Box>

				{reviews.length === 0 ? (
					<Alert severity='info'>Нет отзывов на модерации</Alert>
				) : (
					<Grid container spacing={3}>
						{reviews.map(review => (
							<Grid item xs={12} md={6} key={review.id}>
								<Card>
									<CardContent>
										<Box display='flex' justifyContent='space-between' mb={2}>
											<Typography variant='h6'>
												{review.is_anonymous
													? 'Анонимный пользователь'
													: `${review.user?.first_name} ${review.user?.last_name}`}
											</Typography>
											<Typography variant='caption' color='text.secondary'>
												{new Date(review.created_at).toLocaleDateString()}
											</Typography>
										</Box>
										<Rating value={review.rating} readOnly sx={{ mb: 2 }} />
										<Typography variant='body1'>{review.content}</Typography>
										{!review.is_anonymous && (
											<Typography
												variant='caption'
												color='text.secondary'
												sx={{ mt: 2, display: 'block' }}
											>
												Email: {review.user?.email}
											</Typography>
										)}
									</CardContent>
									<CardActions>
										<Button
											variant='contained'
											color='success'
											startIcon={<ApproveIcon />}
											onClick={() => handleApprove(review.id)}
										>
											Одобрить
										</Button>
										<Button
											variant='contained'
											color='error'
											startIcon={<RejectIcon />}
											onClick={() => handleReject(review.id)}
										>
											Отклонить
										</Button>
									</CardActions>
								</Card>
							</Grid>
						))}
					</Grid>
				)}
			</Paper>
		</Container>
	)
}

export default PendingReviews
