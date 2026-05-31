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
  CardMedia,
  CardActions,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import achievementService, { getUploadUrl } from "../services/achievementService";
import { uploadFile } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Истории успеха";
const PUBLIC_PAGE_URL = "/achievements";

const emptyForm = {
  child_name: "",
  image_url: "",
  second_image_url: "",
  description: "",
  conclusion: "",
  is_visible: true,
  sort_order: 0,
};

export default function AdminAchievements() {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setList(await achievementService.adminGetAll());
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredList = list.filter((item) => {
    const value = `${item.child_name || ""} ${item.conclusion || ""} ${item.description || ""}`.toLowerCase();
    return value.includes(search.toLowerCase().trim());
  });

  const openCreate = () => {
    const nextOrder =
      list.length > 0 ? Math.max(...list.map((item) => item.sort_order ?? 0)) + 1 : 1;

    setEditing(null);
    setForm({ ...emptyForm, sort_order: nextOrder });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);

    let desc = item.description || "";

    try {
      const parsed = JSON.parse(desc);
      if (Array.isArray(parsed)) desc = parsed.join("\n");
    } catch {}

    setForm({ ...item, description: desc });
    setOpen(true);
  };

  const handleImageUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadFile(file);
      setForm((prev) => ({ ...prev, [field]: url }));
    } catch {
      toast.error("Ошибка загрузки фото");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.child_name.trim()) {
      toast.error("Введите ФИО ребёнка");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order) || 0,
        description: JSON.stringify(
          form.description
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      };

      if (editing) {
        await achievementService.adminUpdate(editing.id, payload);
      } else {
        await achievementService.adminCreate(payload);
      }

      toast.success(editing ? "История обновлена" : "История создана");
      setOpen(false);
      load();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить историю?")) return;

    try {
      await achievementService.adminDelete(id);
      toast.success("История удалена");
      load();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление историями успеха воспитанников Центра: фотографии,
              описание результатов, финальная фраза, порядок отображения и
              публикация на сайте.
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
              Добавить историю
            </Button>
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat">
            <span>Всего историй</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Опубликовано</span>
            <strong>{list.filter((item) => item.is_visible).length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Скрыто</span>
            <strong>{list.filter((item) => !item.is_visible).length}</strong>
          </div>
        </div>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по историям успеха..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">Найдено: {filteredList.length}</span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredList.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              Истории не найдены
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 2.5,
              }}
            >
              {filteredList.map((item) => (
                <Card
                  key={item.id}
                  className="admin-achievement-card"
                  sx={{ opacity: item.is_visible ? 1 : 0.6 }}
                >
                  {item.image_url ? (
                    <CardMedia
                      component="img"
                      height="220"
                      image={getUploadUrl(item.image_url)}
                      alt={item.child_name}
                      sx={{ objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 220,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f7f4ec",
                        color: "#55707f",
                        fontWeight: 800,
                      }}
                    >
                      Фото не загружено
                    </Box>
                  )}

                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: "#074462", fontWeight: 900 }}>
                      {item.child_name}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={1}>
                      <Chip
                        label={item.is_visible ? "Отображается" : "Скрыто"}
                        color={item.is_visible ? "success" : "default"}
                        size="small"
                      />

                      <Chip label={`Порядок: ${item.sort_order}`} size="small" variant="outlined" />
                    </Box>
                  </CardContent>

                  <CardActions>
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditIcon />
                    </IconButton>

                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
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
          maxWidth="md"
          fullWidth
          PaperProps={{
            className: "admin-module-dialog",
          }}
        >
          <DialogTitle className="admin-module-dialog__title">
            {editing ? "Редактировать историю" : "Добавить историю успеха"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="ФИО ребёнка"
              value={form.child_name}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, child_name: e.target.value }))}
              fullWidth
            />

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Основное фото
              </Typography>

              {form.image_url && (
                <img
                  src={getUploadUrl(form.image_url)}
                  alt=""
                  height={140}
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    marginBottom: 10,
                    objectFit: "cover",
                  }}
                />
              )}

              <Button variant="outlined" component="label" disabled={uploading}>
                {uploading ? "Загружается..." : "Загрузить фото"}

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImageUpload("image_url", e)}
                />
              </Button>

              {form.image_url && (
                <Button
                  color="error"
                  sx={{ ml: 1 }}
                  onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                >
                  Удалить
                </Button>
              )}
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Второе фото
              </Typography>

              {form.second_image_url && (
                <img
                  src={getUploadUrl(form.second_image_url)}
                  alt=""
                  height={140}
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    marginBottom: 10,
                    objectFit: "cover",
                  }}
                />
              )}

              <Button variant="outlined" component="label" disabled={uploading}>
                {uploading ? "Загружается..." : "Загрузить второе фото"}

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImageUpload("second_image_url", e)}
                />
              </Button>

              {form.second_image_url && (
                <Button
                  color="error"
                  sx={{ ml: 1 }}
                  onClick={() => setForm((prev) => ({ ...prev, second_image_url: "" }))}
                >
                  Удалить
                </Button>
              )}
            </Box>

            <TextField
              label="Описание"
              value={form.description}
              multiline
              rows={6}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
              helperText="Каждая строка станет отдельным абзацем на сайте"
            />

            <TextField
              label="Вывод / финальная фраза"
              value={form.conclusion}
              onChange={(e) => setForm((prev) => ({ ...prev, conclusion: e.target.value }))}
              fullWidth
              placeholder="Маленькими шагами к большим возможностям!"
            />

            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <TextField
                label="Порядок сортировки"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                sx={{ width: 220 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_visible}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_visible: e.target.checked }))
                    }
                  />
                }
                label="Отображать на сайте"
              />
            </Box>
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)}>Отмена</Button>

            <Button variant="contained" onClick={handleSave} disabled={saving || !form.child_name}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}
