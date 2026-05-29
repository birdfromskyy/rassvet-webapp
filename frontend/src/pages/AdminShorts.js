import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Switch, FormControlLabel,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Card, CardContent, CardActions,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import shortsService from '../services/shortsService'

const empty = { title: '', video_url: '', sort_order: 0, is_active: true }

export default function AdminShorts() {
  const navigate = useNavigate()
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setList(await shortsService.adminGetAll()) }
    catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    const nextOrder = list.length > 0 ? Math.max(...list.map(i => i.sort_order ?? 0)) + 1 : 1
    setEditing(null); setForm({ ...empty, sort_order: nextOrder }); setOpen(true)
  }
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setOpen(true) }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Укажите название'); return }
    setSaving(true)
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 }
      if (editing) await shortsService.adminUpdate(editing.id, payload)
      else await shortsService.adminCreate(payload)
      toast.success(editing ? 'Обновлено' : 'Создано')
      setOpen(false); load()
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить шортс?')) return
    try { await shortsService.adminDelete(id); load() }
    catch { toast.error('Ошибка') }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Шортсы (видео на главной)</Typography>
            <Typography variant="body2" color="text.secondary">
              Добавьте ссылку VK Клип / VK Видео или прямой mp4 — плеер загрузится автоматически
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Добавить шортс
            </Button>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/admin/cms')}>Назад</Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : list.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Шортсов нет</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
            {list.map(item => (
              <Card key={item.id} variant="outlined" sx={{ opacity: item.is_active ? 1 : 0.5 }}>
                <Box sx={{
                  height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: '#0c3a52', borderRadius: '4px 4px 0 0', overflow: 'hidden',
                }}>
                  {item.video_url ? (
                    <Typography fontSize={32} sx={{ opacity: 0.5 }}>▶</Typography>
                  ) : (
                    <Typography color="text.disabled" fontSize={13}>Нет видео</Typography>
                  )}
                </Box>
                <CardContent sx={{ pb: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.is_active ? '✅ Видна' : '🙈 Скрыта'} · #{item.sort_order}
                  </Typography>
                  {item.video_url && (
                    <Typography variant="caption" color="text.secondary" display="block"
                      noWrap sx={{ maxWidth: 200, opacity: 0.7 }}>
                      {item.video_url}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <IconButton size="small" onClick={() => openEdit(item)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать шортс' : 'Добавить шортс'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Название *"
              value={form.title}
              required
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              fullWidth size="small"
            />

            <TextField
              label="Ссылка на видео *"
              value={form.video_url}
              onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))}
              fullWidth size="small"
              placeholder="https://vk.com/clip-12345_67890"
              helperText="VK Клип, VK Видео или прямая mp4-ссылка. Заставка не нужна — плеер загружается автоматически."
            />

            <Box display="flex" gap={2} alignItems="center">
              <TextField
                label="Порядок"
                type="number"
                value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                size="small"
                sx={{ width: 120 }}
              />
              <FormControlLabel
                control={<Switch checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label="Отображать"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
