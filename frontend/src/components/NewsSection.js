import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Box,
	Typography,
	Grid,
	Button,
	CircularProgress,
	Alert,
	Paper,
} from '@mui/material'
import { ArrowForward } from '@mui/icons-material'
import NewsCard from './NewsCard'
import newsService from '../services/newsService'

const NewsSection = ({ limit = 3 }) => {
	const navigate = useNavigate()
	const [articles, setArticles] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		fetchLatestArticles()
	}, [])

	const fetchLatestArticles = async () => {
		try {
			const data = await newsService.getLatestArticles(limit)
			setArticles(data)
		} catch (error) {
			setError('Не удалось загрузить новости')
			console.error('Error fetching latest articles:', error)
		} finally {
			setLoading(false)
		}
	}

	if (loading) {
		return (
			<Box display='flex' justifyContent='center' p={3}>
				<CircularProgress />
			</Box>
		)
	}

	if (error) {
		return (
			<Alert severity='error' sx={{ m: 2 }}>
				{error}
			</Alert>
		)
	}

	if (articles.length === 0) {
		return null
	}

	return (
		<Paper elevation={2} sx={{ p: 3, mb: 3 }}>
			<Box
				display='flex'
				justifyContent='space-between'
				alignItems='center'
				mb={3}
			>
				<Typography variant='h5'>📰 Последние новости</Typography>
				<Button endIcon={<ArrowForward />} onClick={() => navigate('/news')}>
					Все новости
				</Button>
			</Box>

			<Grid container spacing={3}>
				{articles.map(article => (
					<Grid item xs={12} md={4} key={article.id}>
						<NewsCard article={article} />
					</Grid>
				))}
			</Grid>
		</Paper>
	)
}

export default NewsSection
