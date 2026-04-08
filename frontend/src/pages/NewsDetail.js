import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Chip,
	Grid,
	CircularProgress,
	Alert,
	Divider,
} from '@mui/material'
import {
	ArrowBack,
	CalendarToday,
	Person,
	Visibility,
	Category,
} from '@mui/icons-material'
import NewsCard from '../components/NewsCard'
import newsService from '../services/newsService'

const NewsDetail = () => {
	const { slug } = useParams()
	const navigate = useNavigate()
	const [article, setArticle] = useState(null)
	const [relatedArticles, setRelatedArticles] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const hasLoadedRef = useRef(false)

	useEffect(() => {
		// Проверяем, была ли уже загрузка
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true
			fetchArticle()
		}
	}, [slug])

	// Сбрасываем ref при изменении slug
	useEffect(() => {
		return () => {
			hasLoadedRef.current = false
		}
	}, [slug])

	const fetchArticle = async () => {
		setLoading(true)
		try {
			const data = await newsService.getArticleBySlug(slug)
			setArticle(data)

			// Загружаем связанные статьи
			const related = await newsService.getRelatedArticles(slug, 3)
			setRelatedArticles(related)
		} catch (error) {
			setError('Не удалось загрузить статью')
			console.error('Error fetching article:', error)
		} finally {
			setLoading(false)
		}
	}

	const formatDate = dateString => {
		return new Date(dateString).toLocaleDateString('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
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

	if (loading) {
		return (
			<Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
				<CircularProgress />
			</Container>
		)
	}

	if (error || !article) {
		return (
			<Container maxWidth='lg' sx={{ mt: 4 }}>
				<Alert severity='error'>{error || 'Статья не найдена'}</Alert>
				<Button
					startIcon={<ArrowBack />}
					onClick={() => navigate('/news')}
					sx={{ mt: 2 }}
				>
					Вернуться к новостям
				</Button>
			</Container>
		)
	}

	return (
		<Container maxWidth='lg' sx={{ mt: 4 }}>
			<Grid container spacing={3}>
				{/* Основной контент */}
				<Grid item xs={12} md={8}>
					<Paper elevation={3} sx={{ p: 4 }}>
						<Button
							startIcon={<ArrowBack />}
							onClick={() => navigate('/news')}
							sx={{ mb: 3 }}
						>
							Все новости
						</Button>

						{article.category && (
							<Chip
								icon={<Category />}
								label={getCategoryLabel(article.category)}
								color='primary'
								sx={{ mb: 2 }}
							/>
						)}

						<Typography variant='h3' component='h1' gutterBottom>
							{article.title}
						</Typography>

						{article.summary && (
							<Typography
								variant='h6'
								color='text.secondary'
								paragraph
								sx={{ fontStyle: 'italic' }}
							>
								{article.summary}
							</Typography>
						)}

						<Box display='flex' gap={3} mb={3} flexWrap='wrap'>
							<Box display='flex' alignItems='center' gap={0.5}>
								<CalendarToday sx={{ fontSize: 18 }} />
								<Typography variant='body2' color='text.secondary'>
									{formatDate(article.published_at || article.date_created)}
								</Typography>
							</Box>
							{article.author && (
								<Box display='flex' alignItems='center' gap={0.5}>
									<Person sx={{ fontSize: 18 }} />
									<Typography variant='body2' color='text.secondary'>
										{article.author}
									</Typography>
								</Box>
							)}
							<Box display='flex' alignItems='center' gap={0.5}>
								<Visibility sx={{ fontSize: 18 }} />
								<Typography variant='body2' color='text.secondary'>
									{article.view_count} просмотров
								</Typography>
							</Box>
						</Box>

						{article.image_url && (
							<Box mb={3}>
								<img
									src={article.image_url}
									alt={article.title}
									style={{
										width: '100%',
										height: 'auto',
										borderRadius: '8px',
									}}
								/>
							</Box>
						)}

						<Divider sx={{ my: 3 }} />

						{/* Контент статьи */}
						<Box
							className='article-content'
							dangerouslySetInnerHTML={{ __html: article.content }}
							sx={{
								'& p': { marginBottom: 2 },
								'& h2': { marginTop: 3, marginBottom: 2 },
								'& h3': { marginTop: 2, marginBottom: 1 },
								'& img': {
									maxWidth: '100%',
									height: 'auto',
									borderRadius: '8px',
									margin: '20px 0',
								},
								'& ul, & ol': { marginLeft: 3, marginBottom: 2 },
								'& blockquote': {
									borderLeft: '4px solid',
									borderColor: 'primary.main',
									paddingLeft: 2,
									marginLeft: 0,
									fontStyle: 'italic',
								},
							}}
						/>

						{article.tags && article.tags.length > 0 && (
							<Box mt={4}>
								<Typography variant='h6' gutterBottom>
									Теги:
								</Typography>
								<Box display='flex' gap={1} flexWrap='wrap'>
									{article.tags.map((tag, index) => (
										<Chip
											key={index}
											label={tag}
											variant='outlined'
											size='small'
										/>
									))}
								</Box>
							</Box>
						)}
					</Paper>
				</Grid>

				{/* Боковая панель */}
				<Grid item xs={12} md={4}>
					{relatedArticles.length > 0 && (
						<Paper
							variant='outlined'
							sx={{ p: 2, position: 'sticky', top: 20 }}
						>
							<Typography variant='h6' gutterBottom>
								📖 Похожие статьи
							</Typography>
							{relatedArticles.map(article => (
								<NewsCard
									key={article.id}
									article={article}
									variant='compact'
								/>
							))}
						</Paper>
					)}
				</Grid>
			</Grid>
		</Container>
	)
}

export default NewsDetail
