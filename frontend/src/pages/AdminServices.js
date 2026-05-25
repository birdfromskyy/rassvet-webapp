import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Chip, CircularProgress, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { serviceCmsService } from '../services/cmsService'

const TYPES = { services_list: 'services_list', about_services: 'about_services' }

const emptyForm = (type) => ({ parent_id: '', title: '', text: '', items: '', sort_order: 0, is_active: true, type })

export default function AdminServices() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const currentType = tab === 0 ? TYPES.services_list : TYPES.about_services

  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm(TYPES.services_list))
  const [itemsText, setItemsText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = (type) => {
    setLoading(true)
    serviceCmsService.getAllAdmin(type).then(setServices).finally(() => setLoading(false))
  }

  useEffect(() => { load(currentType) }, [currentType])

  // Top-level items (no parent) for the parent selector
  const topLevel = services.filter(s => !s.parent_id)

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm(currentType), sort_order: services.length })
    setItemsText('')
    setOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      parent_id: item.parent_id ?? '',
      title: item.title,
      text: item.text || '',
      sort_order: item.sort_order,
      is_active: item.is_active,
      type: item.type,
    })
    try { setItemsText(JSON.parse(item.items || '[]').join('\n')) } catch { setItemsText('') }
    setOpen(true)
  }

  const handleClose = () => { setOpen(false); setEditing(null) }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Введите название'); return }
    setSaving(true)
    try {
      const itemsJson = JSON.stringify(
        itemsText.split('\n').map(s => s.trim()).filter(Boolean)
      )
      const data = {
        ...form,
        parent_id: form.parent_id === '' ? null : Number(form.parent_id),
        items: itemsJson,
        sort_order: Number(form.sort_order) || 0,
        type: currentType,
      }
      if (editing) {
        await serviceCmsService.update(editing.id, data)
        toast.success('Обновлено')
      } else {
        await serviceCmsService.create(data)
        toast.success('Создано')
      }
      handleClose()
      load(currentType)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись?')) return
    try {
      await serviceCmsService.delete(id)
      toast.success('Удалено')
      load(currentType)
    } catch { toast.error('Ошибка удаления') }
  }

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const parentName = (id) => {
    if (!id) return '—'
    return services.find(s => s.id === id)?.title || String(id)
  }

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={2}>
          <Typography variant='h4'>Услуги центра</Typography>
          <Box display='flex' gap={2}>
            <Button variant='contained' startIcon={<AddIcon />} onClick={openCreate}>Добавить</Button>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/admin/cms')}>Назад</Button>
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label='Перечень услуг (/services-list)' />
          <Tab label='Описание услуг (/about_services)' />
        </Tabs>

        {loading ? (
          <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Порядок</TableCell>
                  {currentType === TYPES.services_list && <TableCell>Раздел (родитель)</TableCell>}
                  <TableCell>Название</TableCell>
                  <TableCell>Текст</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align='center'>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.map(s => (
                  <TableRow key={s.id} sx={s.parent_id ? { backgroundColor: '#fafafa' } : {}}>
                    <TableCell>{s.sort_order}</TableCell>
                    {currentType === TYPES.services_list && (
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>
                        {s.parent_id ? parentName(s.parent_id) : <strong>— раздел —</strong>}
                      </TableCell>
                    )}
                    <TableCell sx={{ pl: s.parent_id ? 4 : 1 }}>{s.title}</TableCell>
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
        <DialogTitle>{editing ? 'Редактировать' : 'Новая запись'}</DialogTitle>
        <DialogContent>
          <Box display='flex' flexDirection='column' gap={2} sx={{ mt: 1 }}>
            {currentType === TYPES.services_list && (
              <FormControl fullWidth>
                <InputLabel>Раздел (родитель)</InputLabel>
                <Select
                  value={form.parent_id}
                  label='Раздел (родитель)'
                  onChange={f('parent_id')}
                >
                  <MenuItem value=''>— верхний уровень (раздел) —</MenuItem>
                  {topLevel
                    .filter(s => !editing || s.id !== editing.id)
                    .map(s => (
                      <MenuItem key={s.id} value={s.id}>{s.title}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
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
