import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Typography,
	Grid,
	Box,
	Button,
	TextField,
	MenuItem,
	Pagination,
	CircularProgress,
	Alert,
	Paper,
	InputAdornment,
} from '@mui/material'
import { ArrowBack, Search, FilterList } from '@mui/icons-material'
import NewsCard from '../components/NewsCard'
import newsService from '../services/newsService'

const News = () => {
	const navigate = useNavigate()
	const [articles, setArticles] = useState([])
	const [popularArticles, setPopularArticles] = useState([])
	const [categories, setCategories] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	// Фильтры и пагинация
	const [page, setPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [search, setSearch] = useState('')
	const [category, setCategory] = useState('')
	const [searchInput, setSearchInput] = useState('')

	useEffect(() => {
		fetchCategories()
		fetchPopularArticles()
	}, [])

	useEffect(() => {
		fetchArticles()
	}, [page, search, category])

	const fetchArticles = async () => {
		setLoading(true)
		try {
			const params = {
				page,
				limit: 9,
				...(search && { search }),
				...(category && { category }),
			}
			const data = await newsService.getPublishedArticles(params)
			setArticles(data.articles || [])
			setTotalPages(data.pagination?.pages || 1)
		} catch (error) {
			setError('Не удалось загрузить новости')
			console.error('Error fetching articles:', error)
		} finally {
			setLoading(false)
		}
	}

	const fetchPopularArticles = async () => {
		try {
			const data = await newsService.getPopularArticles(5)
			setPopularArticles(data)
		} catch (error) {
			console.error('Error fetching popular articles:', error)
		}
	}

	const fetchCategories = async () => {
		try {
			const data = await newsService.getCategories()
			setCategories(data)
		} catch (error) {
			console.error('Error fetching categories:', error)
		}
	}

	const handleSearch = e => {
		e.preventDefault()
		setSearch(searchInput)
		setPage(1)
	}

	const handleCategoryChange = e => {
		setCategory(e.target.value)
		setPage(1)
	}

	const getCategoryLabel = cat => {
		const labels = {
			news: 'Новости',
			articles: 'Статьи',
			updates: 'Обновления',
			events: 'События',
		}
		return labels[cat] || cat
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
					<Typography variant='h4'>Новости и статьи</Typography>
					<Button
						startIcon={<ArrowBack />}
						onClick={() => navigate('/dashboard')}
					>
						На главную
					</Button>
				</Box>

				{/* Фильтры */}
				<Box component='form' onSubmit={handleSearch} mb={4}>
					<Grid container spacing={2} alignItems='center'>
						<Grid item xs={12} md={6}>
							<TextField
								fullWidth
								placeholder='Поиск по новостям...'
								value={searchInput}
								onChange={e => setSearchInput(e.target.value)}
								InputProps={{
									startAdornment: (
										<InputAdornment position='start'>
											<Search />
										</InputAdornment>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12} md={3}>
							<TextField
								fullWidth
								select
								label='Категория'
								value={category}
								onChange={handleCategoryChange}
								InputProps={{
									startAdornment: (
										<InputAdornment position='start'>
											<FilterList />
										</InputAdornment>
									),
								}}
							>
								<MenuItem value=''>Все категории</MenuItem>
								{categories.map(cat => (
									<MenuItem key={cat} value={cat}>
										{getCategoryLabel(cat)}
									</MenuItem>
								))}
							</TextField>
						</Grid>
						<Grid item xs={12} md={3}>
							<Button
								fullWidth
								variant='contained'
								type='submit'
								sx={{ height: '56px' }}
							>
								Искать
							</Button>
						</Grid>
					</Grid>
				</Box>

				<Grid container spacing={3}>
					{/* Основной контент */}
					<Grid item xs={12} md={8}>
						{loading ? (
							<Box display='flex' justifyContent='center' p={3}>
								<CircularProgress />
							</Box>
						) : error ? (
							<Alert severity='error'>{error}</Alert>
						) : articles.length === 0 ? (
							<Alert severity='info'>Новости не найдены</Alert>
						) : (
							<>
								<Grid container spacing={3}>
									{articles.map(article => (
										<Grid item xs={12} md={6} key={article.id}>
											<NewsCard article={article} />
										</Grid>
									))}
								</Grid>
								{totalPages > 1 && (
									<Box display='flex' justifyContent='center' mt={4}>
										<Pagination
											count={totalPages}
											page={page}
											onChange={(e, value) => setPage(value)}
											color='primary'
										/>
									</Box>
								)}
							</>
						)}
					</Grid>

					{/* Боковая панель */}
					<Grid item xs={12} md={4}>
						<Paper
							variant='outlined'
							sx={{ p: 2, position: 'sticky', top: 20 }}
						>
							<Typography variant='h6' gutterBottom>
								🔥 Популярные статьи
							</Typography>
							{popularArticles.map(article => (
								<NewsCard
									key={article.id}
									article={article}
									variant='compact'
								/>
							))}
						</Paper>
					</Grid>
				</Grid>
			</Paper>
		</Container>
	)
}

export default News
