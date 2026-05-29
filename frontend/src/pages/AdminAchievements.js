import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Switch, FormControlLabel,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Card, CardContent, CardMedia, CardActions,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import achievementService, { getUploadUrl } from '../services/achievementService'
import { uploadFile } from '../services/cmsService'

const emptyForm = {
  child_name: '', image_url: '', second_image_url: '',
  description: '', conclusion: '', is_visible: true, sort_order: 0,
}

export default function AdminAchievements() {
  const navigate = useNavigate()
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try { setList(await achievementService.adminGetAll()) }
    catch { toast.error('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    const nextOrder = list.length > 0 ? Math.max(...list.map(i => i.sort_order ?? 0)) + 1 : 1
    setEditing(null); setForm({ ...emptyForm, sort_order: nextOrder }); setOpen(true)
  }
  const openEdit   = (item) => {
    setEditing(item)
    // description: parse JSON array → newline-separated text for editing
    let desc = item.description || ''
    try {
      const arr = JSON.parse(desc)
      if (Array.isArray(arr)) desc = arr.join('\n')
    } catch {}
    setForm({ ...item, description: desc })
    setOpen(true)
  }

  const handleImageUpload = async (field, e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm(p => ({ ...p, [field]: url }))
    } catch { toast.error('Ошибка загрузки фото') }
    finally { setUploading(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert newline-separated description to JSON array
      const payload = {
        ...form,
        sort_order: Number(form.sort_order) || 0,
        description: JSON.stringify(
          form.description.split('\n').map(s => s.trim()).filter(Boolean)
        ),
      }
      if (editing) await achievementService.adminUpdate(editing.id, payload)
      else await achievementService.adminCreate(payload)
      toast.success(editing ? 'Обновлено' : 'Создано')
      setOpen(false); load()
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить историю?')) return
    try { await achievementService.adminDelete(id); load() }
    catch { toast.error('Ошибка') }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">Истории успеха</Typography>
            <Typography variant="body2" color="text.secondary">CMS → страница /achievements</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Добавить историю
            </Button>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/admin/cms')}>Назад</Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : list.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            Истории не добавлены
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
            {list.map(item => (
              <Card key={item.id} variant="outlined" sx={{ opacity: item.is_visible ? 1 : 0.5 }}>
                {item.image_url && (
                  <CardMedia
                    component="img"
                    height="160"
                    image={getUploadUrl(item.image_url)}
                    alt={item.child_name}
                    sx={{ objectFit: 'cover' }}
                  />
                )}
                <CardContent sx={{ pb: 0 }}>
                  <Typography variant="h6">{item.child_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.is_visible ? '✅ Отображается' : '🙈 Скрыто'} · Порядок: {item.sort_order}
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Редактировать историю' : 'Добавить историю успеха'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="ФИО ребёнка *" value={form.child_name} required
              onChange={e => setForm(p => ({ ...p, child_name: e.target.value }))} fullWidth size="small" />

            <Box>
              <Typography variant="body2" color="text.secondary" mb={0.5}>Основное фото</Typography>
              {form.image_url && (
                <img src={getUploadUrl(form.image_url)} alt="" height={80}
                  style={{ borderRadius: 4, marginBottom: 8, objectFit: 'cover' }} />
              )}
              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                {uploading ? 'Загружается...' : 'Загрузить фото'}
                <input type="file" accept="image/*" hidden onChange={e => handleImageUpload('image_url', e)} />
              </Button>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" mb={0.5}>Второе фото (необязательно)</Typography>
              {form.second_image_url && (
                <img src={getUploadUrl(form.second_image_url)} alt="" height={80}
                  style={{ borderRadius: 4, marginBottom: 8, objectFit: 'cover' }} />
              )}
              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                Загрузить второе фото
                <input type="file" accept="image/*" hidden onChange={e => handleImageUpload('second_image_url', e)} />
              </Button>
            </Box>

            <TextField
              label="Описание (каждый абзац — с новой строки)"
              value={form.description} multiline rows={5}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              fullWidth size="small"
              helperText="Каждая строка станет отдельным абзацем на сайте"
            />

            <TextField label="Вывод / финальная фраза" value={form.conclusion}
              onChange={e => setForm(p => ({ ...p, conclusion: e.target.value }))}
              fullWidth size="small"
              placeholder="Маленькими шагами к большим возможностям!" />

            <Box display="flex" gap={2} alignItems="center">
              <TextField label="Порядок сортировки" type="number" value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                size="small" sx={{ width: 180 }} />
              <FormControlLabel
                control={<Switch checked={form.is_visible}
                  onChange={e => setForm(p => ({ ...p, is_visible: e.target.checked }))} />}
                label="Отображать на сайте"
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
