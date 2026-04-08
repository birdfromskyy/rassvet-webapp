import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Container,
	Paper,
	Typography,
	Box,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Chip,
	Alert,
} from '@mui/material'
import {
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	Visibility as ViewIcon,
	ArrowBack as BackIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import api from '../services/api'

const AdminArticles = () => {
	const navigate = useNavigate()
	const [articles, setArticles] = useState([])
	const [loading, setLoading] = useState(true)
	const [openDialog, setOpenDialog] = useState(false)
	const [editMode, setEditMode] = useState(false)
	const [selectedArticle, setSelectedArticle] = useState(null)
	const [formData, setFormData] = useState({
		title: '',
		slug: '',
		summary: '',
		content: '',
		category: 'news',
		tags: [],
		author: '',
		status: 'draft',
		publish_now: false,
	})

	useEffect(() => {
		fetchArticles()
	}, [])

	const fetchArticles = async () => {
		try {
			const response = await api.get('/admin/articles')
			setArticles(response.data)
		} catch (error) {
			toast.error('Ошибка загрузки статей')
		} finally {
			setLoading(false)
		}
	}

	const handleOpenDialog = (article = null) => {
		if (article) {
			setEditMode(true)
			setSelectedArticle(article)
			setFormData({
				title: article.title,
				slug: article.slug,
				summary: article.summary || '',
				content: article.content,
				category: article.category || 'news',
				tags: article.tags || [],
				author: article.author || '',
				status: article.status,
				publish_now: false,
			})
		} else {
			setEditMode(false)
			setSelectedArticle(null)
			setFormData({
				title: '',
				slug: '',
				summary: '',
				content: '',
				category: 'news',
				tags: [],
				author: '',
				status: 'draft',
				publish_now: false,
			})
		}
		setOpenDialog(true)
	}

	const handleCloseDialog = () => {
		setOpenDialog(false)
		setSelectedArticle(null)
	}

	const handleSubmit = async () => {
		try {
			if (editMode) {
				await api.put(`/admin/articles/${selectedArticle.id}`, formData)
				toast.success('Статья обновлена')
			} else {
				await api.post('/admin/articles', formData)
				toast.success('Статья создана')
			}
			handleCloseDialog()
			fetchArticles()
		} catch (error) {
			toast.error('Ошибка сохранения статьи')
			console.error(error)
		}
	}

	const handleDelete = async id => {
		if (window.confirm('Удалить эту статью?')) {
			try {
				await api.delete(`/admin/articles/${id}`)
				toast.success('Статья удалена')
				fetchArticles()
			} catch (error) {
				toast.error('Ошибка удаления статьи')
			}
		}
	}

	const generateSlug = title => {
		// Таблица транслитерации
		const translitMap = {
			а: 'a',
			б: 'b',
			в: 'v',
			г: 'g',
			д: 'd',
			е: 'e',
			ё: 'yo',
			ж: 'zh',
			з: 'z',
			и: 'i',
			й: 'y',
			к: 'k',
			л: 'l',
			м: 'm',
			н: 'n',
			о: 'o',
			п: 'p',
			р: 'r',
			с: 's',
			т: 't',
			у: 'u',
			ф: 'f',
			х: 'h',
			ц: 'ts',
			ч: 'ch',
			ш: 'sh',
			щ: 'sch',
			ъ: '',
			ы: 'y',
			ь: '',
			э: 'e',
			ю: 'yu',
			я: 'ya',
			А: 'A',
			Б: 'B',
			В: 'V',
			Г: 'G',
			Д: 'D',
			Е: 'E',
			Ё: 'Yo',
			Ж: 'Zh',
			З: 'Z',
			И: 'I',
			Й: 'Y',
			К: 'K',
			Л: 'L',
			М: 'M',
			Н: 'N',
			О: 'O',
			П: 'P',
			Р: 'R',
			С: 'S',
			Т: 'T',
			У: 'U',
			Ф: 'F',
			Х: 'H',
			Ц: 'Ts',
			Ч: 'Ch',
			Ш: 'Sh',
			Щ: 'Sch',
			Ъ: '',
			Ы: 'Y',
			Ь: '',
			Э: 'E',
			Ю: 'Yu',
			Я: 'Ya',
		}

		// Транслитерация
		let slug = title
			.split('')
			.map(char => translitMap[char] || char)
			.join('')

		// Приводим к нижнему регистру и заменяем пробелы и спецсимволы
		slug = slug
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')

		return slug
	}

	const handleTitleChange = e => {
		const title = e.target.value
		setFormData({
			...formData,
			title,
			slug: generateSlug(title),
		})
	}

	const getStatusColor = status => {
		switch (status) {
			case 'published':
				return 'success'
			case 'draft':
				return 'default'
			case 'archived':
				return 'error'
			default:
				return 'default'
		}
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
					<Typography variant='h4'>Управление статьями</Typography>
					<Box>
						<Button
							variant='contained'
							startIcon={<AddIcon />}
							onClick={() => handleOpenDialog()}
							sx={{ mr: 2 }}
						>
							Создать статью
						</Button>
						<Button
							startIcon={<BackIcon />}
							onClick={() => navigate('/dashboard')}
						>
							На главную
						</Button>
					</Box>
				</Box>

				<TableContainer>
					<Table>
						<TableHead>
							<TableRow>
								<TableCell>Заголовок</TableCell>
								<TableCell>Категория</TableCell>
								<TableCell>Статус</TableCell>
								<TableCell>Просмотры</TableCell>
								<TableCell>Дата создания</TableCell>
								<TableCell align='center'>Действия</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{articles.map(article => (
								<TableRow key={article.id}>
									<TableCell>{article.title}</TableCell>
									<TableCell>{article.category || '-'}</TableCell>
									<TableCell>
										<Chip
											label={article.status}
											color={getStatusColor(article.status)}
											size='small'
										/>
									</TableCell>
									<TableCell>{article.view_count}</TableCell>
									<TableCell>
										{new Date(article.date_created).toLocaleDateString('ru-RU')}
									</TableCell>
									<TableCell align='center'>
										<IconButton
											onClick={() => navigate(`/news/${article.slug}`)}
											size='small'
										>
											<ViewIcon />
										</IconButton>
										<IconButton
											onClick={() => handleOpenDialog(article)}
											size='small'
										>
											<EditIcon />
										</IconButton>
										<IconButton
											onClick={() => handleDelete(article.id)}
											size='small'
											color='error'
										>
											<DeleteIcon />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>

				{/* Dialog для создания/редактирования */}
				<Dialog
					open={openDialog}
					onClose={handleCloseDialog}
					maxWidth='md'
					fullWidth
				>
					<DialogTitle>
						{editMode ? 'Редактировать статью' : 'Создать новую статью'}
					</DialogTitle>
					<DialogContent>
						<Box sx={{ pt: 2 }}>
							<TextField
								fullWidth
								label='Заголовок'
								value={formData.title}
								onChange={handleTitleChange}
								sx={{ mb: 2 }}
								required
							/>
							<TextField
								fullWidth
								label='URL (slug) - генерируется автоматически'
								value={formData.slug}
								onChange={e =>
									setFormData({ ...formData, slug: e.target.value })
								}
								sx={{ mb: 2 }}
								required
								helperText='URL-адрес статьи (автоматическая транслитерация)'
							/>
							<TextField
								fullWidth
								label='Краткое описание'
								value={formData.summary}
								onChange={e =>
									setFormData({ ...formData, summary: e.target.value })
								}
								multiline
								rows={2}
								sx={{ mb: 2 }}
							/>
							<TextField
								fullWidth
								label='Содержание (можно использовать HTML)'
								value={formData.content}
								onChange={e =>
									setFormData({ ...formData, content: e.target.value })
								}
								multiline
								rows={8}
								sx={{ mb: 2 }}
								required
								placeholder='<p>Текст статьи...</p>'
							/>
							<Box display='flex' gap={2} mb={2}>
								<FormControl fullWidth>
									<InputLabel>Категория</InputLabel>
									<Select
										value={formData.category}
										label='Категория'
										onChange={e =>
											setFormData({ ...formData, category: e.target.value })
										}
									>
										<MenuItem value='news'>Новости</MenuItem>
										<MenuItem value='articles'>Статьи</MenuItem>
										<MenuItem value='updates'>Обновления</MenuItem>
										<MenuItem value='events'>События</MenuItem>
									</Select>
								</FormControl>
								<FormControl fullWidth>
									<InputLabel>Статус</InputLabel>
									<Select
										value={formData.status}
										label='Статус'
										onChange={e =>
											setFormData({ ...formData, status: e.target.value })
										}
									>
										<MenuItem value='draft'>Черновик</MenuItem>
										<MenuItem value='published'>Опубликовано</MenuItem>
										<MenuItem value='archived'>В архиве</MenuItem>
									</Select>
								</FormControl>
							</Box>
							<TextField
								fullWidth
								label='Автор'
								value={formData.author}
								onChange={e =>
									setFormData({ ...formData, author: e.target.value })
								}
								sx={{ mb: 2 }}
							/>
							<TextField
								fullWidth
								label='Теги (через запятую)'
								value={formData.tags.join(', ')}
								onChange={e =>
									setFormData({
										...formData,
										tags: e.target.value
											.split(',')
											.map(t => t.trim())
											.filter(t => t),
									})
								}
								helperText='Например: новости, обновление, важное'
							/>
						</Box>
					</DialogContent>
					<DialogActions>
						<Button onClick={handleCloseDialog}>Отмена</Button>
						<Button onClick={handleSubmit} variant='contained'>
							{editMode ? 'Сохранить' : 'Создать'}
						</Button>
					</DialogActions>
				</Dialog>
			</Paper>
		</Container>
	)
}

export default AdminArticles
