import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Select,
  MenuItem, FormControl, InputLabel, Tooltip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  DeleteSweep as AnonymizeIcon,
  DeleteForever as HardDeleteIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import consultationService from '../services/consultationService'

const STATUS_META = {
  new:       { label: 'Новая',    color: 'warning' },
  contacted: { label: 'Связались', color: 'info' },
  closed:    { label: 'Закрыта',  color: 'default' },
}
const STATUS_OPTIONS = [
  { value: 'new',       label: 'Новая' },
  { value: 'contacted', label: 'Связались' },
  { value: 'closed',    label: 'Закрыта' },
]

const CONTACT_LABELS = {
  phone: 'Звонок', vk: 'ВКонтакте', max: 'MAX', email: 'Email',
}

const contactDetail = (r) => {
  if (r.contact_method === 'email' && r.contact_email) return `Email: ${r.contact_email}`
  if (r.contact_method === 'vk' && r.contact_email) return `VK: ${r.contact_email}`
  return null
}

export default function AdminConsultations() {
  const navigate = useNavigate()
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [dialog, setDialog]   = useState({ open: false, item: null })
  const [editStatus, setEditStatus] = useState('new')
  const [editNote, setEditNote]     = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    try { setList(await consultationService.adminList()) }
    catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openDialog = (item) => {
    setDialog({ open: true, item })
    setEditStatus(item.status)
    setEditNote(item.admin_note || '')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await consultationService.adminUpdate(dialog.item.id, {
        status: editStatus, admin_note: editNote,
      })
      toast.success('Обновлено')
      setDialog({ open: false, item: null })
      load()
    } catch { toast.error('Ошибка') }
    finally { setSaving(false) }
  }

  const handleAnonymize = async (id) => {
    if (!window.confirm('Удалить персональные данные заявки?\nСтатус и запись сохранятся в БД.')) return
    try { await consultationService.adminAnonymize(id); toast.success('Данные очищены'); load() }
    catch { toast.error('Ошибка') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('ПОЛНОЕ удаление записи из БД без возможности восстановления.')) return
    try { await consultationService.adminDelete(id); load() }
    catch { toast.error('Ошибка удаления') }
  }

  const q = search.toLowerCase()
  const filtered = q
    ? list.filter(r => [r.parent_fio, r.child_fio, r.phone, r.contact_email]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    : list

  const newCount = list.filter(r => r.status === 'new').length

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Заявки на консультацию</Typography>
            {newCount > 0 && (
              <Chip label={`${newCount} новых`} color="warning" size="small" sx={{ mt: 0.5 }} />
            )}
          </Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Назад</Button>
        </Box>

        <TextField
          label="Поиск по ФИО, телефону или email"
          value={search} onChange={e => setSearch(e.target.value)}
          fullWidth size="small" sx={{ mb: 3 }}
        />

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Заявок нет</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Родитель</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell>Ребёнок / возраст</TableCell>
                <TableCell>Связь</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(r => {
                const meta = STATUS_META[r.status] || { label: r.status, color: 'default' }
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.parent_fio}</Typography>
                      {r.user_id && (
                        <Typography variant="caption" color="text.secondary">авторизован</Typography>
                      )}
                    </TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.child_fio}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.child_age}</Typography>
                    </TableCell>
                    <TableCell>
                      {CONTACT_LABELS[r.contact_method] || r.contact_method}
                      {contactDetail(r) && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {contactDetail(r)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={meta.label} color={meta.color} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button size="small" variant="outlined" onClick={() => openDialog(r)}>
                          Открыть
                        </Button>
                        <Tooltip title="Удалить ПД, запись сохраняется">
                          <Button size="small" variant="outlined" color="warning"
                            startIcon={<AnonymizeIcon />}
                            onClick={() => handleAnonymize(r.id)}>
                            Очистить
                          </Button>
                        </Tooltip>
                        <Tooltip title="Полностью удалить из БД">
                          <Button size="small" variant="outlined" color="error"
                            startIcon={<HardDeleteIcon />}
                            onClick={() => handleDelete(r.id)}>
                            Удалить
                          </Button>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, item: null })}
        maxWidth="sm" fullWidth>
        <DialogTitle>Заявка от {dialog.item?.parent_fio}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Все данные заявки */}
            <Box sx={{ background: '#f8fafc', borderRadius: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                <b>Дата:</b> {dialog.item?.created_at ? new Date(dialog.item.created_at).toLocaleString('ru-RU') : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <b>Родитель:</b> {dialog.item?.parent_fio || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <b>Телефон:</b> {dialog.item?.phone || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <b>Ребёнок:</b> {dialog.item?.child_fio || '—'}{dialog.item?.child_age ? `, ${dialog.item.child_age}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <b>Способ связи:</b> {CONTACT_LABELS[dialog.item?.contact_method] || dialog.item?.contact_method || '—'}
                {dialog.item && contactDetail(dialog.item) && ` — ${contactDetail(dialog.item)}`}
              </Typography>
            </Box>
            {dialog.item?.request_text && (
              <Box sx={{ background: '#f1f5f9', borderRadius: 1, p: 2 }}>
                <Typography variant="caption" color="text.secondary">Обращение:</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {dialog.item.request_text}
                </Typography>
              </Box>
            )}
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select value={editStatus} label="Статус" onChange={e => setEditStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Заметки (внутренние, родитель не видит)"
              value={editNote} onChange={e => setEditNote(e.target.value)}
              fullWidth size="small" multiline rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, item: null })}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
