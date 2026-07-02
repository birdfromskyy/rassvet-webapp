import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material'
import { ArrowBack as BackIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import supportService, {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_COLOR,
} from '../services/supportService'
import './AdminModule.scss'

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'open', label: 'Открыто' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрыто' },
]

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AdminSupport() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await supportService.adminListTickets({ status: statusFilter || undefined })
      setTickets(data)
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const q = search.toLowerCase().trim()
  const filtered = q
    ? tickets.filter(t =>
        [t.subject, t.user?.first_name, t.user?.last_name, t.user?.email]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      )
    : tickets

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length

  return (
    <main className='admin-module'>
      <div className='admin-module__container'>

        <section className='admin-module__hero'>
          <div>
            <span className='admin-module__badge'>Техподдержка</span>
            <h1>Обращения</h1>
            <p>
              Управление заявками пользователей в службу технической поддержки учебного центра «РАСсвет».
            </p>
          </div>
          <div className='admin-module__actions'>
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate('/dashboard')}
              className='admin-module__button admin-module__button--ghost'
            >
              Назад
            </Button>
          </div>
        </section>

        <div className='admin-users-stats'>
          <div className='admin-users-stat'>
            <span>Всего</span>
            <strong>{tickets.length}</strong>
          </div>
          <div className='admin-users-stat'>
            <span>Открыто</span>
            <strong>{openCount}</strong>
          </div>
          <div className='admin-users-stat'>
            <span>В работе</span>
            <strong>{inProgressCount}</strong>
          </div>
          <div className='admin-users-stat'>
            <span>Закрыто</span>
            <strong>{tickets.length - openCount - inProgressCount}</strong>
          </div>
        </div>

        <section className='admin-module__panel'>
          <div className='admin-module__toolbar'>
            <div className='admin-module__search'>
              <SearchIcon />
              <input
                type='text'
                placeholder='Поиск по теме, имени или email...'
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Box display='flex' gap={1.5} alignItems='center' flexWrap='wrap'>
              <FormControl size='small' sx={{ minWidth: 160 }}>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  label='Статус'
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <span className='admin-module__count'>Найдено: {filtered.length}</span>
            </Box>
          </div>

          {loading ? (
            <Box display='flex' justifyContent='center' p={4}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Typography color='text.secondary' align='center' sx={{ py: 6 }}>
              Обращений нет
            </Typography>
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>№</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Пользователь</TableCell>
                    <TableCell>Тема</TableCell>
                    <TableCell>Категория</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align='right'>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t.id} hover>
                      <TableCell sx={{ color: '#8a9fb0', fontWeight: 700 }}>
                        #{t.id}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {fmt(t.created_at)}
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' fontWeight={700}>
                          {t.user ? `${t.user.first_name} ${t.user.last_name}` : '—'}
                        </Typography>
                        {t.user?.email && (
                          <Typography variant='caption' color='text.secondary'>
                            {t.user.email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography
                          variant='body2'
                          fontWeight={600}
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}
                          title={t.subject}
                        >
                          {t.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {SUPPORT_CATEGORY_LABEL[t.category] || t.category}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SUPPORT_STATUS_LABEL[t.status] || t.status}
                          color={SUPPORT_STATUS_COLOR[t.status] || 'default'}
                          size='small'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Button
                          size='small'
                          variant='outlined'
                          onClick={() => navigate(`/admin/support/${t.id}`)}
                          sx={{
                            borderRadius: '999px', textTransform: 'none',
                            fontWeight: 700, borderColor: '#074462', color: '#074462',
                          }}
                        >
                          Открыть
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

      </div>
    </main>
  )
}
