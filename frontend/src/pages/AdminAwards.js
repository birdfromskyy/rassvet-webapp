import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Switch, FormControlLabel,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Card, CardMedia, CardContent, CardActions,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import awardService from '../services/awardService'
import { uploadFile, getUploadUrl } from '../services/cmsService'

const empty = { title: '', image_url: '', sort_order: 0, is_visible: true }

export default function AdminAwards() {
  const navigate = useNavigate()
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(empty)
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try { setList(await awardService.adminGetAll()) }
    catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    const nextOrder = list.length > 0 ? Math.max(...list.map(i => i.sort_order ?? 0)) + 1 : 1
    setEditing(null); setForm({ ...empty, sort_order: nextOrder }); setOpen(true)
  }
  const openEdit   = (item) => { setEditing(item); setForm({ ...item }); setOpen(true) }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm(p => ({ ...p, image_url: url }))
    } catch { toast.error('Ошибка загрузки') }
    finally { setUploading(false) }
  }

  const handleSave = async () => {
    if (!form.image_url) { toast.error('Загрузите изображение'); return }
    setSaving(true)
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 }
      if (editing) await awardService.adminUpdate(editing.id, payload)
      else await awardService.adminCreate(payload)
      toast.success(editing ? 'Обновлено' : 'Создано')
      setOpen(false); load()
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить награду?')) return
    try { await awardService.adminDelete(id); load() }
    catch { toast.error('Ошибка') }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Награды и дипломы</Typography>
            <Typography variant="body2" color="text.secondary">CMS → страница /awards</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Добавить награду
            </Button>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/admin/cms')}>Назад</Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : list.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Наград нет</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {list.map(item => (
              <Card key={item.id} variant="outlined" sx={{ opacity: item.is_visible ? 1 : 0.5 }}>
                <CardMedia
                  component="img" height="260"
                  image={getUploadUrl(item.image_url)} alt={item.title}
                  sx={{ objectFit: 'contain', p: 1, bgcolor: '#f8fafc' }}
                />
                <CardContent sx={{ pb: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{item.title || '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.is_visible ? '✅ Видна' : '🙈 Скрыта'} · #{item.sort_order}
                  </Typography>
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
        <DialogTitle>{editing ? 'Редактировать награду' : 'Добавить награду'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" mb={0.5}>Изображение *</Typography>
              {form.image_url && (
                <img src={getUploadUrl(form.image_url)} alt="" height={120}
                  style={{ borderRadius: 4, marginBottom: 8, objectFit: 'contain', border: '1px solid #eee' }} />
              )}
              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                {uploading ? 'Загружается...' : (form.image_url ? 'Заменить' : 'Загрузить изображение')}
                <input type="file" accept="image/*" hidden onChange={handleUpload} />
              </Button>
            </Box>

            <TextField label="Название / подпись" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              fullWidth size="small" placeholder="Диплом победителя..." />

            <Box display="flex" gap={2} alignItems="center">
              <TextField label="Порядок" type="number" value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                size="small" sx={{ width: 130 }} />
              <FormControlLabel
                control={<Switch checked={form.is_visible}
                  onChange={e => setForm(p => ({ ...p, is_visible: e.target.checked }))} />}
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
