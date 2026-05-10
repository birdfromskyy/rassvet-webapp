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
	Link,
} from '@mui/material'
import {
	ArrowBack,
	CalendarToday,
	Visibility,
	Category,
	Download,
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
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true
			fetchArticle()
		}
	}, [slug])

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

	const getVkEmbedUrl = url => {
		if (!url) return null

		if (url.includes('video_ext.php')) return url

		const match = url.match(/video-?(\d+)_(\d+)/)
		if (!match) return null

		const ownerId = `-${match[1]}`
		const videoId = match[2]

		return `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hd=2`
	}

	const renderBlock = (block, index) => {
		if (!block?.collection || !block?.item) return null

		switch (block.collection) {
			case 'block_text':
				return (
					<Box
						key={`${block.collection}-${block.id}-${index}`}
						sx={{
							mb: 3,
							'& p': { marginBottom: 2 },
							'& h2': { marginTop: 3, marginBottom: 2 },
							'& h3': { marginTop: 2, marginBottom: 1 },
							'& ul, & ol': { marginLeft: 3, marginBottom: 2 },
							'& blockquote': {
								borderLeft: '4px solid',
								borderColor: 'primary.main',
								paddingLeft: 2,
								marginLeft: 0,
								fontStyle: 'italic',
							},
						}}
						dangerouslySetInnerHTML={{ __html: block.item.text || '' }}
					/>
				)

			case 'block_image': {
				const imageUrl = newsService.getAssetUrl(
					block.item.image?.id || block.item.image,
				)
				if (!imageUrl) return null

				return (
					<Box key={`${block.collection}-${block.id}-${index}`} mb={3}>
						<img
							src={imageUrl}
							alt='Изображение новости'
							style={{
								width: '100%',
								height: 'auto',
								borderRadius: '8px',
							}}
						/>
					</Box>
				)
			}

			case 'block_video': {
				const embedUrl = getVkEmbedUrl(block.item.video_url)
				if (!embedUrl) {
					return (
						<Box key={`${block.collection}-${block.id}-${index}`} mb={3}>
							<Link
								href={block.item.video_url}
								target='_blank'
								rel='noopener noreferrer'
							>
								Открыть видео
							</Link>
						</Box>
					)
				}

				return (
					<Box key={`${block.collection}-${block.id}-${index}`} mb={3}>
						<Box
							sx={{
								position: 'relative',
								paddingBottom: '56.25%',
								height: 0,
								overflow: 'hidden',
								borderRadius: '8px',
							}}
						>
							<iframe
								src={embedUrl}
								title='Видео'
								allow='autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;'
								allowFullScreen
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									border: 'none',
								}}
							/>
						</Box>
					</Box>
				)
			}

			case 'block_file': {
				const fileUrl = newsService.getAssetDownloadUrl(
					block.item.file?.id || block.item.file,
				)
				if (!fileUrl) return null

				return (
					<Box key={`${block.collection}-${block.id}-${index}`} mb={3}>
						<Paper variant='outlined' sx={{ p: 2 }}>
							<Box display='flex' alignItems='center' gap={1}>
								<Download />
								<Link
									href={fileUrl}
									target='_blank'
									rel='noopener noreferrer'
									underline='hover'
								>
									{block.item.title ||
										block.item.file?.filename_download ||
										'Скачать файл'}
								</Link>
							</Box>
						</Paper>
					</Box>
				)
			}

			default:
				return null
		}
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
						</Box>

						{newsService.getImageUrl(
							article.featured_image?.id || article.featured_image,
						) && (
							<Box mb={3}>
								<img
									src={newsService.getImageUrl(
										article.featured_image?.id || article.featured_image,
									)}
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

						<Box>
							{article.blocks?.map((block, index) => renderBlock(block, index))}
						</Box>

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
