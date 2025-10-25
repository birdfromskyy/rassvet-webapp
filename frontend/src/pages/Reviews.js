import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Typography,
	Button,
	Box,
	CircularProgress,
	Alert,
	Paper,
} from '@mui/material'
import { Add as AddIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import reviewService from '../services/reviewService'
import ReviewCard from '../components/ReviewCard'

const Reviews = ({ user }) => {
	const navigate = useNavigate()
	const [reviews, setReviews] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		fetchReviews()
	}, [])

	const fetchReviews = async () => {
		try {
			const data = await reviewService.getPublishedReviews()
			setReviews(data)
		} catch (error) {
			setError('Ошибка загрузки отзывов')
			console.error('Error fetching reviews:', error)
		} finally {
			setLoading(false)
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
		<Container maxWidth='md' sx={{ mt: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={3}
				>
					<Typography variant='h4'>Отзывы</Typography>
					<Box>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/dashboard')}
							sx={{ mr: 2 }}
						>
							На главную
						</Button>
						<Button
							variant='contained'
							startIcon={<AddIcon />}
							onClick={() => navigate('/create-review')}
						>
							Написать отзыв
						</Button>
					</Box>
				</Box>

				{error && (
					<Alert severity='error' sx={{ mb: 2 }}>
						{error}
					</Alert>
				)}

				{reviews.length === 0 ? (
					<Typography variant='body1' color='text.secondary' align='center'>
						Пока нет отзывов. Будьте первым!
					</Typography>
				) : (
					reviews.map(review => <ReviewCard key={review.id} review={review} />)
				)}
			</Paper>
		</Container>
	)
}

export default Reviews
