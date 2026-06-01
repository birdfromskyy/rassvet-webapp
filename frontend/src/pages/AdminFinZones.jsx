import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { finZoneService, uploadFile, getUploadUrl } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Материальная база";
const PUBLIC_PAGE_URL = "/fin-activities";

const emptyForm = {
  title: "",
  text: "",
  image_url: "",
  image_url_2: "",
  image_caption: "",
  sort_order: 0,
  is_active: true,
};

export default function AdminFinZones() {
  const navigate = useNavigate();

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    finZoneService
      .getAllAdmin()
      .then(setZones)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filteredZones = zones.filter((zone) => {
    const value = `${zone.title} ${zone.text || ""}`.toLowerCase();
    return value.includes(search.toLowerCase().trim());
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: zones.length });
    setOpen(true);
  };

  const openEdit = (zone) => {
    setEditing(zone);
    setForm({ ...zone });
    setOpen(true);
  };

  const handleImageUpload = async (e, field = "image_url") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, [field]: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await finZoneService.update(editing.id, form);
      } else {
        await finZoneService.create(form);
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить зону?")) return;

    await finZoneService.delete(id);
    load();
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление помещениями и зонами Центра: фотографии, подписи,
              описание, список элементов, порядок отображения и публикация на
              сайте.
            </p>
          </div>

          <div className="admin-module__actions">
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate("/admin/cms")}
              className="admin-module__button admin-module__button--ghost"
            >
              Назад
            </Button>

            <Button
              component="a"
              href={PUBLIC_PAGE_URL}
              target="_blank"
              rel="noreferrer"
              className="admin-module__button admin-module__button--outline"
            >
              Перейти на страницу
            </Button>

            <Button
              startIcon={<AddIcon />}
              onClick={openCreate}
              className="admin-module__button admin-module__button--primary"
            >
              Добавить зону
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по зонам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredZones.length}
            </span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={90}>Порядок</TableCell>
                    <TableCell>Заголовок</TableCell>
                    <TableCell>Фото</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredZones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell>{zone.sort_order}</TableCell>

                      <TableCell>{zone.title || <span style={{color:'#aaa',fontStyle:'italic'}}>вводный блок</span>}</TableCell>

                      <TableCell>
                        {zone.image_url ? (
                          <img
                            src={getUploadUrl(zone.image_url)}
                            alt=""
                            height={44}
                            style={{
                              width: 76,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={zone.is_active ? "Активна" : "Скрыта"}
                          size="small"
                          color={zone.is_active ? "success" : "default"}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(zone)}>
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(zone.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredZones.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          Зоны не найдены
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            className: "admin-module-dialog",
          }}
        >
          <DialogTitle className="admin-module-dialog__title">
            {editing ? "Редактировать зону" : "Добавить зону"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="Заголовок раздела"
              value={form.title}
              fullWidth
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              helperText='Например: "Помещение для дневного пребывания". Оставьте пустым для вводного блока (без заголовка).'
            />

            <TextField
              label="Текст"
              value={form.text}
              fullWidth
              multiline
              rows={4}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  text: e.target.value,
                }))
              }
              helperText="Новый абзац — двойной Enter (пустая строка). Одиночный Enter объединяется с предыдущей строкой."
            />

            {/* Photo 1 */}
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Фото 1
              </Typography>
              {form.image_url && (
                <Box mb={1}>
                  <img src={getUploadUrl(form.image_url)} alt="" style={{ width: "100%", maxHeight: 160, borderRadius: 12, objectFit: "cover" }} />
                </Box>
              )}
              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                {uploading ? "Загружается..." : "Загрузить фото 1"}
                <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(e, "image_url")} />
              </Button>
              {form.image_url && (
                <Button size="small" color="error" sx={{ ml: 1 }} onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                  Удалить
                </Button>
              )}
            </Box>

            {/* Photo 2 */}
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Фото 2 (необязательно)
              </Typography>
              {form.image_url_2 && (
                <Box mb={1}>
                  <img src={getUploadUrl(form.image_url_2)} alt="" style={{ width: "100%", maxHeight: 160, borderRadius: 12, objectFit: "cover" }} />
                </Box>
              )}
              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                {uploading ? "Загружается..." : "Загрузить фото 2"}
                <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(e, "image_url_2")} />
              </Button>
              {form.image_url_2 && (
                <Button size="small" color="error" sx={{ ml: 1 }} onClick={() => setForm((f) => ({ ...f, image_url_2: "" }))}>
                  Удалить
                </Button>
              )}
            </Box>

            <TextField
              label="Подпись под фотографиями"
              value={form.image_caption}
              fullWidth
              onChange={(e) => setForm((f) => ({ ...f, image_caption: e.target.value }))}
              placeholder="Рисунки 1, 2 – Здание и детская площадка"
            />

            <TextField
              label="Порядок отображения"
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sort_order: parseInt(e.target.value, 10) || 0,
                }))
              }
              helperText="Меньшее число — выше в списке"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      is_active: e.target.checked,
                    }))
                  }
                />
              }
              label="Отображать на сайте"
            />
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)}>Отмена</Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || (!form.title && !form.text)}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}