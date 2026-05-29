import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import { ArrowBack as BackIcon, Download as DownloadIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import questionnaireService from '../services/questionnaireService'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

const downloadQuestionnaireFile = async (id, filename) => {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/admin/questionnaires/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Ошибка загрузки')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `questionnaire_${id}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Не удалось скачать файл')
  }
}

const STATUS_META = {
  pending:  { label: 'На проверке', color: 'warning' },
  approved: { label: 'Принята',     color: 'success' },
  rejected: { label: 'Отклонена',   color: 'error' },
}

export default function AdminQuestionnaires() {
  const navigate  = useNavigate()
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog]   = useState({ open: false, item: null })
  const [editStatus, setEditStatus] = useState('pending')
  const [editNote, setEditNote]     = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    try { setList(await questionnaireService.adminList()) }
    catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openDialog = (item) => {
    setDialog({ open: true, item })
    setEditStatus(item.status)
    setEditNote(item.admin_note || '')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить анкету? Файл будет удалён безвозвратно.')) return
    try {
      await questionnaireService.adminDelete(id)
      toast.success('Анкета удалена')
      load()
    } catch { toast.error('Ошибка удаления') }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await questionnaireService.adminUpdateStatus(dialog.item.id, editStatus, editNote)
      toast.success('Статус обновлён')
      setDialog({ open: false, item: null })
      load()
    } catch { toast.error('Ошибка') }
    finally { setSaving(false) }
  }

  const pendingCount = list.filter(q => q.status === 'pending').length

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Анкеты родителей</Typography>
            {pendingCount > 0 && (
              <Chip label={`${pendingCount} на проверке`} color="warning" size="small" sx={{ mt: 0.5 }} />
            )}
          </Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Назад</Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : list.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Анкет нет</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Пользователь</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map(q => {
                const meta = STATUS_META[q.status] || { label: q.status, color: 'default' }
                const fullName = [q.user_last_name, q.user_first_name].filter(Boolean).join(' ')
                return (
                  <TableRow key={q.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(q.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{fullName || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{q.user_email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small" variant="outlined" startIcon={<DownloadIcon />}
                        onClick={() => downloadQuestionnaireFile(q.id, q.file_name)}
                      >
                        Скачать
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Chip label={meta.label} color={meta.color} size="small" />
                      {q.admin_note && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          {q.admin_note}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button size="small" variant="outlined" onClick={() => openDialog(q)}>
                          Решение
                        </Button>
                        <Button size="small" variant="outlined" color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(q.id)}>
                          Удалить
                        </Button>
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
        <DialogTitle>Решение по анкете</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Пользователь: {[dialog.item?.user_last_name, dialog.item?.user_first_name].filter(Boolean).join(' ')}
              {' · '}{dialog.item?.user_email}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select value={editStatus} label="Статус" onChange={e => setEditStatus(e.target.value)}>
                <MenuItem value="pending">На проверке</MenuItem>
                <MenuItem value="approved">Принята (разрешить подачу документов)</MenuItem>
                <MenuItem value="rejected">Требует уточнения</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Примечание для пользователя"
              value={editNote} onChange={e => setEditNote(e.target.value)}
              fullWidth size="small" multiline rows={3}
              helperText="При rejected — будет показано пользователю в уведомлении"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, item: null })}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Применить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
