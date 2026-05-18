import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Box, Button, TextField,
  IconButton, CircularProgress, Divider, Alert,
} from '@mui/material'
import { ArrowBack as BackIcon, Save as SaveIcon } from '@mui/icons-material'
import { siteSettingService, uploadFile, getUploadUrl } from '../services/cmsService'

// Keys that hold JSON arrays of strings — edited as newline-separated text
const JSON_ARRAY_KEYS = ['mission_goals', 'fin_hero_list', 'social_forms_json']

const SECTIONS = [
  {
    title: 'Главная страница (/)',
    fields: [
      { key: 'home_video_url', label: 'Ссылка на видео-визитку', multiline: false },
    ],
  },
  {
    title: 'Миссия (/mission)',
    fields: [
      { key: 'mission_hero_title', label: 'Заголовок hero-блока', multiline: false },
      { key: 'mission_hero_text', label: 'Текст hero-блока', multiline: true, rows: 3 },
      { key: 'mission_goals', label: 'Цели центра (каждая с новой строки)', multiline: true, rows: 6, isJsonArray: true },
    ],
  },
  {
    title: 'Структура организации (/structure)',
    fields: [
      { key: 'structure_photo_url', label: 'Фото структуры (URL после загрузки)', multiline: false, isPhoto: true },
    ],
  },
  {
    title: 'Материальная база (/fin_activities) — текст',
    fields: [
      { key: 'fin_hero_text', label: 'Описание в hero-блоке', multiline: true, rows: 3 },
    ],
  },
  {
    title: 'Свободные места (/available_places)',
    fields: [
      { key: 'available_stats_total', label: 'Общее количество мест', multiline: false },
      { key: 'available_stats_budget', label: 'За счёт бюджетных ассигнований', multiline: false },
      { key: 'available_stats_personal', label: 'За счёт средств физических лиц', multiline: false },
      { key: 'available_stats_form_text', label: 'Форма обслуживания (текст)', multiline: true, rows: 2 },
    ],
  },
]

export default function AdminSiteSettings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Convert stored JSON arrays to newline-separated text for display
  const toDisplay = (key, value) => {
    if (!value) return ''
    if (JSON_ARRAY_KEYS.includes(key)) {
      try { return JSON.parse(value).join('\n') } catch { return value }
    }
    return value
  }

  // Convert newline-separated text back to JSON array for JSON_ARRAY_KEYS
  const toStorage = (key, value) => {
    if (JSON_ARRAY_KEYS.includes(key)) {
      return JSON.stringify(value.split('\n').map(s => s.trim()).filter(Boolean))
    }
    return value
  }

  useEffect(() => {
    siteSettingService.getAll().then(raw => {
      const display = {}
      Object.entries(raw).forEach(([k, v]) => { display[k] = toDisplay(k, v) })
      setSettings(display)
    }).finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }))
  }

  const handleSave = async (key) => {
    setSaving(key)
    try {
      const value = toStorage(key, settings[key] || '')
      await siteSettingService.upsert(key, value)
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  const handlePhotoUpload = async (key, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setSettings(s => ({ ...s, [key]: url }))
      await siteSettingService.upsert(key, url)
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/admin/cms')}><BackIcon /></IconButton>
        <Typography variant="h5">Настройки страниц</Typography>
      </Box>

      {SECTIONS.map((section, si) => (
        <Paper key={si} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" mb={2}>{section.title}</Typography>
          <Divider sx={{ mb: 2 }} />

          {section.fields.map(field => (
            <Box key={field.key} mb={3}>
              {field.isPhoto ? (
                <>
                  <Typography variant="body2" color="text.secondary" mb={1}>{field.label}</Typography>
                  {settings[field.key] && (
                    <Box mb={1}>
                      <img src={getUploadUrl(settings[field.key])} alt="" height={120}
                        style={{ borderRadius: 4, objectFit: 'contain', border: '1px solid #eee' }} />
                    </Box>
                  )}
                  <Button variant="outlined" component="label" disabled={uploading} size="small">
                    {uploading ? 'Загружается...' : 'Загрузить фото'}
                    <input type="file" accept="image/*" hidden
                      onChange={e => handlePhotoUpload(field.key, e)} />
                  </Button>
                  {saved === field.key && <Alert severity="success" sx={{ mt: 1 }}>Сохранено!</Alert>}
                </>
              ) : (
                <Box display="flex" gap={1} alignItems="flex-start">
                  <TextField
                    label={field.label}
                    value={settings[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    fullWidth
                    multiline={field.multiline}
                    rows={field.rows || 1}
                    helperText={saved === field.key ? '✓ Сохранено' : undefined}
                    FormHelperTextProps={{ style: { color: 'green' } }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => handleSave(field.key)}
                    disabled={saving === field.key}
                    sx={{ mt: 1, whiteSpace: 'nowrap' }}
                  >
                    {saving === field.key ? '...' : 'Сохранить'}
                  </Button>
                </Box>
              )}
            </Box>
          ))}
        </Paper>
      ))}
    </Container>
  )
}
