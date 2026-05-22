import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Chip,
	Container,
	Divider,
	Typography,
} from '@mui/material'
import {
	ArrowBack as BackIcon,
	Publish as PublishIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import newsService from '../services/newsService'
import { getUploadUrl } from '../services/cmsService'

const getVkEmbedUrl = url => {
	if (!url) return null
	if (url.includes('video_ext.php')) return url
	const match = url.match(/video-?(\d+)_(\d+)/)
	if (!match) return null
	return `https://vk.com/video_ext.php?oid=-${match[1]}&id=${match[2]}&hd=2`
}

const getUrlBasename = url => {
	try {
		return decodeURIComponent(url.split('/').pop().split('?')[0]) || null
	} catch {
		return null
	}
}

const renderBlock = (block, index) => {
	if (!block?.type) return null
	switch (block.type) {
		case 'text':
			return (
				<Box key={block.id || index} mb={2}>
					{block.content
						.split('\n')
						.filter(p => p.trim())
						.map((para, i) => (
							<Typography key={i} paragraph>
								{para}
							</Typography>
						))}
				</Box>
			)
		case 'image': {
			const imageUrl = getUploadUrl(block.content)
			if (!imageUrl) return null
			return (
				<Box key={block.id || index} mb={2} textAlign='center'>
					<img
						src={imageUrl}
						alt='Изображение'
						style={{ maxWidth: '100%', borderRadius: 8 }}
					/>
				</Box>
			)
		}
		case 'video': {
			const embedUrl = getVkEmbedUrl(block.content)
			if (!embedUrl)
				return (
					<Box key={block.id || index} mb={2}>
						<a href={block.content} target='_blank' rel='noopener noreferrer'>
							Открыть видео
						</a>
					</Box>
				)
			return (
				<Box key={block.id || index} mb={2} sx={{ position: 'relative', paddingTop: '56.25%' }}>
					<iframe
						src={embedUrl}
						title='Видео'
						allow='autoplay; encrypted-media; fullscreen; picture-in-picture'
						allowFullScreen
						style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
					/>
				</Box>
			)
		}
		case 'file': {
			const fileUrl = block.content
			if (!fileUrl) return null
			return (
				<Box key={block.id || index} mb={2}>
					<a href={fileUrl} target='_blank' rel='noopener noreferrer'>
						⬇ {block.title || getUrlBasename(fileUrl) || 'Скачать файл'}
					</a>
				</Box>
			)
		}
		default:
			return null
	}
}

const AdminNewsPreview = () => {
	const { id } = useParams()
	const navigate = useNavigate()
	const [article, setArticle] = useState(null)
	const [loading, setLoading] = useState(true)
	const [publishing, setPublishing] = useState(false)

	useEffect(() => {
		newsService
			.getArticleById(id)
			.then(data => setArticle(data.article || data))
			.catch(() => toast.error('Не удалось загрузить статью'))
			.finally(() => setLoading(false))
	}, [id])

	const publish = async () => {
		setPublishing(true)
		try {
			await newsService.updateArticle(article.id, { ...article, status: 'published' })
			toast.success('Статья опубликована')
			navigate('/admin/cms/news')
		} catch {
			toast.error('Ошибка публикации')
		} finally {
			setPublishing(false)
		}
	}

	if (loading)
		return (
			<Box display='flex' justifyContent='center' p={8}>
				<CircularProgress />
			</Box>
		)

	if (!article)
		return (
			<Container maxWidth='md' sx={{ py: 4 }}>
				<Alert severity='error'>Статья не найдена</Alert>
			</Container>
		)

	const isDraft = article.status === 'draft'

	return (
		<Container maxWidth='md' sx={{ py: 4 }}>
			{/* Admin toolbar */}
			<Box
				display='flex'
				alignItems='center'
				justifyContent='space-between'
				mb={3}
				p={2}
				sx={{ bgcolor: 'grey.100', borderRadius: 2 }}
			>
				<Box display='flex' alignItems='center' gap={1}>
					<Button
						startIcon={<BackIcon />}
						onClick={() => navigate('/admin/cms/news')}
						size='small'
					>
						Назад
					</Button>
					<Chip
						label={isDraft ? 'Черновик' : 'Опубликована'}
						color={isDraft ? 'default' : 'success'}
						size='small'
					/>
				</Box>
				{isDraft && (
					<Button
						variant='contained'
						startIcon={<PublishIcon />}
						onClick={publish}
						disabled={publishing}
					>
						{publishing ? 'Публикация...' : 'Опубликовать'}
					</Button>
				)}
			</Box>

			{/* Article preview */}
			<Box>
				<Typography variant='h4' fontWeight={700} gutterBottom>
					{article.title}
				</Typography>

				{article.summary && (
					<Typography variant='subtitle1' color='text.secondary' gutterBottom>
						{article.summary}
					</Typography>
				)}

				<Typography variant='caption' color='text.disabled' display='block' mb={2}>
					{new Date(article.published_at || article.created_at).toLocaleDateString('ru-RU', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
				</Typography>

				{getUploadUrl(article.featured_image) && (
					<Box mb={3}>
						<img
							src={getUploadUrl(article.featured_image)}
							alt={article.title}
							style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8 }}
						/>
					</Box>
				)}

				<Divider sx={{ mb: 3 }} />

				<Box>{article.blocks?.map((block, i) => renderBlock(block, i))}</Box>
			</Box>
		</Container>
	)
}

export default AdminNewsPreview
