import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material'
import {
  People as EmployeesIcon,
  Folder as FilesIcon,
  Gavel as RulesIcon,
  EmojiEvents as RatingIcon,
  History as HistoryIcon,
  AccountBalance as FinIcon,
  MiscellaneousServices as ServicesIcon,
  Settings as SettingsIcon,
  Article as NewsIcon,
  ManageAccounts as UsersIcon,
  ArrowBack as BackIcon,
  AssignmentInd as DocsIcon,
  Stars as AchievementsIcon,
  MilitaryTech as AwardsIcon,
  ContactPhone as ConsultationsIcon,
  Description as QuestionnaireIcon,
  VideoLibrary as ShortsIcon,
} from '@mui/icons-material'

const MODULES = [
  {
    title: 'Сотрудники',
    description: 'Преподаватели — карточки, фото, квалификация для сайта',
    icon: EmployeesIcon,
    color: 'primary',
    path: '/admin/schedule/teachers',
  },
  {
    title: 'Новости',
    description: 'Статьи и публикации центра',
    icon: NewsIcon,
    color: 'secondary',
    path: '/admin/cms/news',
  },
  {
    title: 'История центра',
    description: 'Хронология событий на странице «О нас»',
    icon: HistoryIcon,
    color: 'info',
    path: '/admin/cms/history',
  },
  {
    title: 'Документы',
    description: 'Файлы раздела «Документы»',
    icon: FilesIcon,
    color: 'success',
    path: '/admin/cms/docs',
  },
  {
    title: 'Внутренний распорядок',
    description: 'Файлы раздела «Внутренний распорядок»',
    icon: RulesIcon,
    color: 'warning',
    path: '/admin/cms/rules',
  },
  {
    title: 'Рейтинг',
    description: 'Файлы раздела «Рейтинг»',
    icon: RatingIcon,
    color: 'error',
    path: '/admin/cms/rating',
  },
  {
    title: 'Фин. деятельность',
    description: 'Блоки страницы «Финансовая деятельность»',
    icon: FinIcon,
    color: 'primary',
    path: '/admin/cms/fin-zones',
  },
  {
    title: 'Услуги',
    description: 'Карточки услуг на странице «Об услугах»',
    icon: ServicesIcon,
    color: 'secondary',
    path: '/admin/cms/services',
  },
  {
    title: 'Настройки сайта',
    description: 'Миссия, структура, видео и другие глобальные настройки',
    icon: SettingsIcon,
    color: 'info',
    path: '/admin/cms/settings',
  },
  {
    title: 'Пользователи',
    description: 'Привязка учеников к учётным записям родителей',
    icon: UsersIcon,
    color: 'success',
    path: '/admin/users',
  },
  {
    title: 'Документы родителей',
    description: 'Проверка и подтверждение документов, поданных родителями',
    icon: DocsIcon,
    color: 'warning',
    path: '/admin/documents',
  },
  {
    title: 'Наши успехи',
    description: 'Истории успеха детей — страница /achievements',
    icon: AchievementsIcon,
    color: 'success',
    path: '/admin/cms/achievements',
  },
  {
    title: 'Награды',
    description: 'Дипломы и благодарности — страница /awards',
    icon: AwardsIcon,
    color: 'info',
    path: '/admin/cms/awards',
  },
  {
    title: 'Заявки на консультацию',
    description: 'Входящие заявки от родителей на консультацию',
    icon: ConsultationsIcon,
    color: 'error',
    path: '/admin/consultations',
  },
  {
    title: 'Анкеты родителей',
    description: 'Проверка заполненных входных анкет',
    icon: QuestionnaireIcon,
    color: 'primary',
    path: '/admin/questionnaires',
  },
  {
    title: 'Шортсы',
    description: 'Видео-шортсы на главной странице',
    icon: ShortsIcon,
    color: 'secondary',
    path: '/admin/cms/shorts',
  },
]

const AdminCMSPanel = () => {
  const navigate = useNavigate()

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box
          display='flex'
          justifyContent='space-between'
          alignItems='center'
          mb={4}
        >
          <Box>
            <Typography variant='h4' gutterBottom>
              Управление сайтом
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Редактирование контента публичных страниц
            </Typography>
          </Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/dashboard')}>
            На главную
          </Button>
        </Box>

        <Grid container spacing={3}>
          {MODULES.map((m) => {
            const Icon = m.icon
            return (
              <Grid item xs={12} sm={6} md={4} key={m.path}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display='flex' alignItems='center' mb={1.5}>
                      <Icon sx={{ fontSize: 36, mr: 2, color: `${m.color}.main` }} />
                      <Typography variant='h6'>{m.title}</Typography>
                    </Box>
                    <Typography variant='body2' color='text.secondary'>
                      {m.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size='small'
                      variant='contained'
                      color={m.color}
                      onClick={() => navigate(m.path)}
                    >
                      Открыть
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </Paper>
    </Container>
  )
}

export default AdminCMSPanel
