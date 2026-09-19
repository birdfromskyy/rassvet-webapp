import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Card,
  CardMedia,
  CardContent,
  CardActions,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";

import awardService from "../services/awardService";
import { uploadFile, getUploadUrl } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Награды";
const PUBLIC_PAGE_URL = "/awards";

const empty = {
  title: "",
  image_url: "",
  sort_order: 0,
  is_visible: true,
};

export default function AdminAwards() {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState(empty);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await awardService.adminGetAll());
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    const nextOrder =
      list.length > 0
        ? Math.max(...list.map((i) => i.sort_order ?? 0)) + 1
        : 1;

    setEditing(null);

    setForm({
      ...empty,
      sort_order: nextOrder,
    });

    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadFile(file);

      setForm((prev) => ({
        ...prev,
        image_url: url,
      }));
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.image_url) {
      toast.error("Загрузите изображение");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order) || 0,
      };

      if (editing) {
        await awardService.adminUpdate(editing.id, payload);
      } else {
        await awardService.adminCreate(payload);
      }

      toast.success(editing ? "Обновлено" : "Создано");

      setOpen(false);
      load();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить награду?")) return;

    try {
      await awardService.adminDelete(id);
      load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const visibleCount = list.filter((item) => item.is_visible).length;
  const hiddenCount = list.filter((item) => !item.is_visible).length;

  return (
    <main className="admin-module">
      <div className="admin-module__container">

        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление дипломами, благодарственными письмами,
              сертификатами и другими наградами Центра.
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
              Добавить награду
            </Button>
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat">
            <span>Всего наград</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Опубликовано</span>
            <strong>{visibleCount}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Скрыто</span>
            <strong>{hiddenCount}</strong>
          </div>
        </div>

        <section className="admin-module__panel">

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : list.length === 0 ? (
            <Typography
              color="text.secondary"
              align="center"
              sx={{ py: 6 }}
            >
              Наград пока нет
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 3,
              }}
            >
              {list.map((item) => (
                <Card
                  key={item.id}
                  className="admin-achievement-card"
                  sx={{
                    opacity: item.is_visible ? 1 : 0.6,
                  }}
                >
                  <CardMedia
                    component="img"
                    height="320"
                    image={getUploadUrl(item.image_url)}
                    alt={item.title}
                    sx={{
                      objectFit: "contain",
                      p: 2,
                      bgcolor: "#f8fafc",
                    }}
                  />

                  <CardContent sx={{ pb: 0 }}>
                    <Typography
                      variant="body1"
                      fontWeight={700}
                    >
                      {item.title || "Без названия"}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {item.is_visible
                        ? "✅ Отображается"
                        : "🙈 Скрыта"}
                    </Typography>
                  </CardContent>

                  <CardActions>
                    <IconButton
                      size="small"
                      onClick={() => openEdit(item)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(item.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              ))}
            </Box>
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
            {editing ? "Редактировать награду" : "Добавить награду"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Изображение *
              </Typography>

              {form.image_url && (
                <img
                  src={getUploadUrl(form.image_url)}
                  alt=""
                  height={180}
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    marginBottom: 12,
                    objectFit: "contain",
                    border: "1px solid rgba(7, 68, 98, 0.12)",
                    background: "#ffffff",
                  }}
                />
              )}

              <Button variant="outlined" component="label" disabled={uploading}>
                {uploading
                  ? "Загружается..."
                  : form.image_url
                  ? "Заменить изображение"
                  : "Загрузить изображение"}

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleUpload}
                />
              </Button>
            </Box>

            <TextField
              label="Название / подпись"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
              fullWidth
              placeholder="Диплом победителя..."
            />

            <TextField
              label="Порядок"
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sort_order: e.target.value,
                }))
              }
              fullWidth
              helperText="Меньшее значение отображается выше"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_visible}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_visible: e.target.checked,
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
              disabled={saving}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}