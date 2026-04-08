import React from 'react'
import { useNavigate } from 'react-router-dom'
import newsService from '../services/newsService'
import {
	Card,
	CardMedia,
	CardContent,
	CardActions,
	Typography,
	Button,
	Chip,
	Box,
} from '@mui/material'
import { CalendarToday, Visibility, Person } from '@mui/icons-material'

const NewsCard = ({ article, variant = 'default' }) => {
	const navigate = useNavigate()

	const handleClick = () => {
		navigate(`/news/${article.slug}`)
	}

	const formatDate = dateString => {
		return new Date(dateString).toLocaleDateString('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	}

	const getCategoryLabel = category => {
		const labels = {
			news: 'Новости',
			articles: 'Статьи',
			updates: 'Обновления',
			events: 'События',
		}
		return labels[category] || category
	}

	// Компактная версия для боковой панели
	if (variant === 'compact') {
		return (
			<Card
				sx={{
					display: 'flex',
					mb: 2,
					cursor: 'pointer',
					'&:hover': { boxShadow: 3 },
				}}
				onClick={handleClick}
			>
				{newsService.getImageUrl(article.featured_image) && (
					<CardMedia
						component='img'
						sx={{ width: 100, height: 100 }}
						image={newsService.getImageUrl(article.featured_image)}
						alt={article.title}
					/>
				)}
				<CardContent sx={{ flex: 1, py: 1 }}>
					<Typography variant='subtitle2' gutterBottom>
						{article.title}
					</Typography>
					<Box display='flex' alignItems='center' gap={1}>
						<CalendarToday sx={{ fontSize: 14 }} />
						<Typography variant='caption' color='text.secondary'>
							{formatDate(article.published_at || article.date_created)}
						</Typography>
					</Box>
				</CardContent>
			</Card>
		)
	}

	// Полная версия карточки
	return (
		<Card
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				cursor: 'pointer',
				transition: 'transform 0.2s',
				'&:hover': {
					transform: 'translateY(-4px)',
					boxShadow: 4,
				},
			}}
			onClick={handleClick}
		>
			{newsService.getImageUrl(article.featured_image) && (
				<CardMedia
					component='img'
					height='200'
					image={newsService.getImageUrl(article.featured_image)}
					alt={article.title}
				/>
			)}
			<CardContent sx={{ flexGrow: 1 }}>
				<Box
					display='flex'
					justifyContent='space-between'
					alignItems='center'
					mb={1}
				>
					{article.category && (
						<Chip
							label={getCategoryLabel(article.category)}
							size='small'
							color='primary'
						/>
					)}
					{article.view_count > 0 && (
						<Box display='flex' alignItems='center' gap={0.5}>
							<Visibility sx={{ fontSize: 16 }} />
							<Typography variant='caption'>{article.view_count}</Typography>
						</Box>
					)}
				</Box>

				<Typography gutterBottom variant='h6' component='h2'>
					{article.title}
				</Typography>

				{article.summary && (
					<Typography
						variant='body2'
						color='text.secondary'
						sx={{
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							display: '-webkit-box',
							WebkitLineClamp: 3,
							WebkitBoxOrient: 'vertical',
						}}
					>
						{article.summary}
					</Typography>
				)}

				<Box display='flex' alignItems='center' gap={2} mt={2}>
					<Box display='flex' alignItems='center' gap={0.5}>
						<CalendarToday sx={{ fontSize: 16 }} />
						<Typography variant='caption' color='text.secondary'>
							{formatDate(article.published_at || article.date_created)}
						</Typography>
					</Box>
					{article.author && (
						<Box display='flex' alignItems='center' gap={0.5}>
							<Person sx={{ fontSize: 16 }} />
							<Typography variant='caption' color='text.secondary'>
								{article.author}
							</Typography>
						</Box>
					)}
				</Box>
			</CardContent>
			<CardActions>
				<Button size='small' color='primary'>
					Читать далее
				</Button>
			</CardActions>
		</Card>
	)
}

export default NewsCard
