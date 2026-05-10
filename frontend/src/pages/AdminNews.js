import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Paper, Typography, Box, Button, Alert } from '@mui/material'
import { ArrowBack, OpenInNew } from '@mui/icons-material'

const AdminNews = () => {
	const navigate = useNavigate()

	const handleOpenDirectus = () => {
		const directusUrl =
			process.env.REACT_APP_DIRECTUS_URL || 'http://localhost:8055'
		window.open(`${directusUrl}/admin/content/articles`, '_blank')
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
					<Typography variant='h4'>Управление новостями</Typography>
					<Button
						startIcon={<ArrowBack />}
						onClick={() => navigate('/dashboard')}
					>
						На главную
					</Button>
				</Box>

				<Alert severity='info' sx={{ mb: 3 }}>
					Управление новостями осуществляется через Directus CMS
				</Alert>

				<Box>
					<Typography variant='body1' paragraph>
						Для создания, редактирования и управления новостями используется
						Directus CMS. Нажмите кнопку ниже, чтобы перейти в панель управления
						контентом.
					</Typography>

					<Button
						variant='contained'
						size='large'
						startIcon={<OpenInNew />}
						onClick={handleOpenDirectus}
						sx={{ mt: 2 }}
					>
						Открыть Directus CMS
					</Button>

					<Box mt={4}>
						<Typography variant='h6' gutterBottom>
							Инструкция по работе с новостями в Directus:
						</Typography>
						<ol>
							<li>
								Войдите в Directus с вашими учетными данными администратора
							</li>
							<li>Перейдите в раздел "Articles" в боковом меню</li>
							<li>Для создания новой статьи нажмите кнопку "+"</li>
							<li>
								Заполните все необходимые поля:
								<ul>
									<li>Title - заголовок статьи</li>
									<li>Slug - URL-адрес статьи (латиницей)</li>
									<li>Summary - краткое описание</li>
									<li>Content - основной текст статьи</li>
									<li>Category - категория</li>
									<li>Featured Image - главное изображение</li>
								</ul>
							</li>
							<li>Измените статус на "Published" для публикации</li>
							<li>Нажмите "Save" для сохранения</li>
						</ol>
					</Box>
				</Box>
			</Paper>
		</Container>
	)
}

export default AdminNews
