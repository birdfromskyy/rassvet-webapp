import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Chip, CircularProgress,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { serviceCmsService } from '../services/cmsService'

const emptyForm = { icon: '', title: '', text: '', items: '', sort_order: 0, is_active: true }

export default function AdminServices() {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [itemsText, setItemsText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    serviceCmsService.getAllAdmin().then(setServices).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sort_order: services.length })
    setItemsText('')
    setOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...item })
    try { setItemsText(JSON.parse(item.items || '[]').join('\n')) } catch { setItemsText('') }
    setOpen(true)
  }

  const handleClose = () => { setOpen(false); setEditing(null) }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Введите название услуги'); return }
    setSaving(true)
    try {
      const itemsJson = JSON.stringify(
        itemsText.split('\n').map(s => s.trim()).filter(Boolean)
      )
      const data = { ...form, items: itemsJson, sort_order: Number(form.sort_order) || 0 }
      if (editing) {
        await serviceCmsService.update(editing.id, data)
        toast.success('Услуга обновлена')
      } else {
        await serviceCmsService.create(data)
        toast.success('Услуга создана')
      }
      handleClose()
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить услугу?')) return
    try {
      await serviceCmsService.delete(id)
      toast.success('Удалено')
      load()
    } catch { toast.error('Ошибка удаления') }
  }

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
          <Typography variant='h4'>Услуги центра</Typography>
          <Box display='flex' gap={2}>
            <Button variant='contained' startIcon={<AddIcon />} onClick={openCreate}>Добавить</Button>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/admin/cms')}>Назад</Button>
          </Box>
        </Box>

        {loading ? (
          <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Порядок</TableCell>
                  <TableCell>Иконка</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Текст</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align='center'>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.sort_order}</TableCell>
                    <TableCell sx={{ fontSize: 24 }}>{s.icon}</TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text}</TableCell>
                    <TableCell>
                      <Chip label={s.is_active ? 'Активна' : 'Скрыта'} color={s.is_active ? 'success' : 'default'} size='small' />
                    </TableCell>
                    <TableCell align='center'>
                      <IconButton size='small' onClick={() => openEdit(s)}><EditIcon /></IconButton>
                      <IconButton size='small' color='error' onClick={() => handleDelete(s.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!services.length && (
                  <TableRow>
                    <TableCell colSpan={6} align='center'>
                      <Typography color='text.secondary'>Нет записей</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
        <DialogTitle>{editing ? 'Редактировать услугу' : 'Новая услуга'}</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
            <TextField label='Иконка (эмодзи)' value={form.icon} onChange={f('icon')} fullWidth placeholder='🎓' />
            <TextField label='Название' value={form.title} onChange={f('title')} fullWidth required />
            <TextField label='Описание' value={form.text} onChange={f('text')} fullWidth multiline rows={3} />
            <TextField
              label='Пункты списка (каждая строка — отдельный пункт)'
              value={itemsText}
              onChange={e => setItemsText(e.target.value)}
              fullWidth
              multiline
              rows={4}
              placeholder={'Пункт 1\nПункт 2\nПункт 3'}
            />
            <TextField
              label='Порядок сортировки'
              type='number'
              value={form.sort_order}
              onChange={f('sort_order')}
              sx={{ width: 180 }}
              inputProps={{ min: 0 }}
            />
            <FormControlLabel
              control={<Switch checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label='Показывать на сайте'
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button onClick={handleSave} variant='contained' disabled={saving}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
