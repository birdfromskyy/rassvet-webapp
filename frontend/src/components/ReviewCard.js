import React from 'react'
import { Card, CardContent, Typography, Rating, Box, Chip } from '@mui/material'

const ReviewCard = ({ review }) => {
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
		<Card sx={{ mb: 2 }}>
			<CardContent>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={2}
				>
					<Typography variant='h6'>
						{review.author_name || 'Анонимный пользователь'}
					</Typography>
					{review.status && (
						<Chip
							label={review.status}
							color={getStatusColor(review.status)}
							size='small'
						/>
					)}
				</Box>
				<Rating value={review.rating} readOnly />
				<Typography variant='body1' sx={{ mt: 2 }}>
					{review.content}
				</Typography>
				<Typography
					variant='caption'
					color='text.secondary'
					sx={{ mt: 1, display: 'block' }}
				>
					{new Date(review.created_at).toLocaleDateString('ru-RU')}
				</Typography>
			</CardContent>
		</Card>
	)
}

export default ReviewCard
