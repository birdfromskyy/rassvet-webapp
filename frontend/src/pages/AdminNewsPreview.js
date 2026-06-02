import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircularProgress } from '@mui/material'
import { toast } from 'react-toastify'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import newsService from '../services/newsService'
import { getUploadUrl } from '../services/cmsService'
import './NewsDetail/NewsDetail.scss'

const getVkEmbedUrl = url => {
	if (!url) return null
	if (url.includes('video_ext.php')) return url
	const videoMatch = url.match(/video-?(\d+)_(\d+)/)
	if (videoMatch) return `https://vk.com/video_ext.php?oid=-${videoMatch[1]}&id=${videoMatch[2]}&hd=2`
	const clipMatch = url.match(/clip-?(\d+)_(\d+)/)
	if (clipMatch) return `https://vk.com/video_ext.php?oid=-${clipMatch[1]}&id=${clipMatch[2]}&hd=2`
	return null
}

const getUrlBasename = url => {
	try { return decodeURIComponent(url.split('/').pop().split('?')[0]) || null } catch { return null }
}

const safeUrl = url => {
	if (!url) return null
	try {
		const p = new URL(url)
		return p.protocol === 'https:' || p.protocol === 'http:' ? url : null
	} catch { return null }
}

const renderBlock = (block, index) => {
	if (!block?.type) return null
	switch (block.type) {
		case 'text':
			return (
				<div key={block.id || index} className="article-block">
					{block.content.split('\n').filter(p => p.trim()).map((para, i) => (
						<p key={i}>{para}</p>
					))}
				</div>
			)
		case 'image': {
			const imageUrl = getUploadUrl(block.content)
			if (!imageUrl) return null
			return (
				<div key={block.id || index} className="article-block">
					<img src={imageUrl} alt="Изображение" className="article-block__image" />
				</div>
			)
		}
		case 'video': {
			const embedUrl = getVkEmbedUrl(block.content)
			if (!embedUrl) {
				const href = safeUrl(block.content)
				if (!href) return null
				return (
					<div key={block.id || index} className="article-file">
						<a href={href} target="_blank" rel="noopener noreferrer">Открыть видео</a>
					</div>
				)
			}
			return (
				<div key={block.id || index} className="article-video">
					<iframe src={embedUrl} title="Видео" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
				</div>
			)
		}
		case 'file': {
			if (!block.content) return null
			return (
				<div key={block.id || index} className="article-file">
					<a href={block.content} target="_blank" rel="noopener noreferrer">
						{block.title || getUrlBasename(block.content) || 'Скачать файл'}
					</a>
				</div>
			)
		}
		default: return null
	}
}

const AdminNewsPreview = () => {
	const { id } = useParams()
	const navigate = useNavigate()
	const [article, setArticle] = useState(null)
	const [loading, setLoading] = useState(true)
	const [publishing, setPublishing] = useState(false)

	useEffect(() => {
		newsService.getArticleById(id)
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

	const formatDate = dateStr => new Date(dateStr).toLocaleDateString('ru-RU', {
		year: 'numeric', month: 'long', day: 'numeric',
	})

	return (
		<div style={{ background: '#f7f4ec', minHeight: '100vh' }}>
			{/* ── Баннер предпросмотра ───────────────────────────────── */}
			<div style={{
				background: '#074462',
				color: '#fff',
				padding: '12px 24px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 16,
				flexWrap: 'wrap',
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					<button
						onClick={() => navigate('/admin/cms/news')}
						style={{
							background: 'rgba(255,255,255,0.12)',
							border: '1.5px solid rgba(255,255,255,0.3)',
							color: '#fff',
							borderRadius: 999,
							padding: '6px 18px',
							fontWeight: 700,
							fontSize: 14,
							cursor: 'pointer',
						}}
					>
						← Назад
					</button>
					<span style={{ fontWeight: 700, fontSize: 14, opacity: 0.85 }}>
						Предпросмотр статьи
					</span>
					{article && (
						<span style={{
							background: article.status === 'published' ? '#22c55e' : '#f7df00',
							color: article.status === 'published' ? '#fff' : '#074462',
							borderRadius: 999,
							padding: '4px 14px',
							fontWeight: 800,
							fontSize: 12,
						}}>
							{article.status === 'published' ? 'Опубликована' : 'Черновик'}
						</span>
					)}
				</div>

				{article?.status === 'draft' && (
					<button
						onClick={publish}
						disabled={publishing}
						style={{
							background: '#f7df00',
							border: 'none',
							color: '#074462',
							borderRadius: 999,
							padding: '8px 24px',
							fontWeight: 800,
							fontSize: 14,
							cursor: publishing ? 'not-allowed' : 'pointer',
							opacity: publishing ? 0.7 : 1,
						}}
					>
						{publishing ? 'Публикуем...' : '✓ Опубликовать'}
					</button>
				)}
			</div>

			<Header />

			<main className="news-detail-page" style={{ paddingTop: 46 }}>
				{loading && (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
						<CircularProgress sx={{ color: '#074462' }} />
					</div>
				)}

				{!loading && !article && (
					<div className="container">
						<div className="news-detail__state news-detail__state--error">
							<h2>Статья не найдена</h2>
							<button onClick={() => navigate('/admin/cms/news')}>Вернуться к списку</button>
						</div>
					</div>
				)}

				{!loading && article && (
					<div className="container">
						<div className="news-detail__layout">
							<article className="news-detail">
								<button className="news-detail__back" onClick={() => navigate('/news')}>
									← К новостям
								</button>

								<h1 className="news-detail__title">{article.title}</h1>

								{article.summary && (
									<p className="news-detail__summary">{article.summary}</p>
								)}

								<div className="news-detail__meta">
									<span>{formatDate(article.published_at || article.created_at)}</span>
								</div>

								{getUploadUrl(article.featured_image) && (
									<img
										src={getUploadUrl(article.featured_image)}
										alt={article.title}
										className="news-detail__cover"
									/>
								)}

								<div className="news-detail__content">
									{article.blocks?.map((block, i) => renderBlock(block, i))}
								</div>
							</article>
						</div>
					</div>
				)}
			</main>

			<Footer />
		</div>
	)
}

export default AdminNewsPreview
