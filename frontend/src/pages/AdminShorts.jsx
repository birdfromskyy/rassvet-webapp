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
import shortsService from "../services/shortsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Шортсы";
const PUBLIC_PAGE_URL = "/main";

const empty = {
  title: "",
  video_url: "",
  sort_order: 0,
  is_active: true,
};

export default function AdminShorts() {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await shortsService.adminGetAll());
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
        ? Math.max(...list.map((item) => item.sort_order ?? 0)) + 1
        : 1;

    setEditing(null);
    setForm({ ...empty, sort_order: nextOrder });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Укажите название");
      return;
    }

    if (!form.video_url.trim()) {
      toast.error("Укажите ссылку на видео");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order) || 0,
      };

      if (editing) {
        await shortsService.adminUpdate(editing.id, payload);
      } else {
        await shortsService.adminCreate(payload);
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
    if (!window.confirm("Удалить шортс?")) return;

    try {
      await shortsService.adminDelete(id);
      load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const activeCount = list.filter((item) => item.is_active).length;
  const hiddenCount = list.filter((item) => !item.is_active).length;

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление короткими видео на главной странице сайта.
              Поддерживаются VK Клипы, VK Видео и прямые ссылки на mp4.
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
              Добавить шортс
            </Button>
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat">
            <span>Всего видео</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Опубликовано</span>
            <strong>{activeCount}</strong>
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
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              Шортсов пока нет
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 3,
              }}
            >
              {list.map((item) => (
                <Card
                  key={item.id}
                  className="admin-achievement-card"
                  sx={{
                    opacity: item.is_active ? 1 : 0.6,
                  }}
                >
                  <Box
                    sx={{
                      height: 240,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#074462",
                      color: "#ffffff",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <Typography
                      sx={{
                        width: 74,
                        height: 74,
                        borderRadius: "50%",
                        background: "#f4df00",
                        color: "#074462",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 34,
                        fontWeight: 900,
                        boxShadow: "0 12px 30px rgba(0,0,0,.22)",
                      }}
                    >
                      ▶
                    </Typography>
                  </Box>

                  <CardContent sx={{ pb: 0 }}>
                    <Typography variant="body1" fontWeight={800} noWrap>
                      {item.title}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" display="block">
                      {item.is_active ? "✅ Отображается" : "🙈 Скрыт"} · #
                      {item.sort_order}
                    </Typography>

                    {item.video_url && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        noWrap
                        sx={{ mt: 0.5, opacity: 0.75 }}
                      >
                        {item.video_url}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions>
                    <IconButton size="small" onClick={() => openEdit(item)}>
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
            {editing ? "Редактировать шортс" : "Добавить шортс"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="Название"
              value={form.title}
              required
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
              fullWidth
            />

            <TextField
              label="Ссылка на видео"
              value={form.video_url}
              required
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  video_url: e.target.value,
                }))
              }
              fullWidth
              placeholder="https://vk.com/clip-12345_67890"
              helperText="VK Клип, VK Видео или прямая mp4-ссылка"
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
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
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

            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}