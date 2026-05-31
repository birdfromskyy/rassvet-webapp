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
import { cmsFileService, getUploadUrl } from "../services/cmsService";

import "./AdminModule.scss";

const emptyForm = {
  title: "",
  description: "",
  file_url: "",
  sort_order: 0,
  is_active: true,
};

const getPublicPageUrl = (section) => {
  const pages = {
    docs: "/docs",
    rules: "/internal-rules",
    rating: "/rating",
  };

  return pages[section] || "/";
};

export default function AdminCmsFiles({ section, title }) {
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const publicPageUrl = getPublicPageUrl(section);

  const filteredFiles = files.filter((file) => {
    const value = `${file.title} ${file.description || ""} ${
      file.file_url || ""
    }`.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  const load = () => {
    setLoading(true);
    cmsFileService
      .getAllAdmin(section)
      .then(setFiles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [section]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: files.length });
    setOpen(true);
  };

  const openEdit = (file) => {
    setEditing(file);
    setForm({ ...file });
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload = { ...form, section };

      if (editing) {
        await cmsFileService.update(editing.id, payload);
      } else {
        await cmsFileService.create(payload);
      }

      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить файл?")) return;

    await cmsFileService.delete(id);
    load();
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{title}</h1>

            <p>
              Управление файлами раздела: название, описание, ссылка на документ,
              порядок отображения и статус публикации на сайте.
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
              href={publicPageUrl}
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
              Добавить файл
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <p className="admin-module__hint">
            Файлы отображаются в порядке поля «Порядок». Меньшее значение —
            выше.
          </p>

          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по документам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredFiles.length}
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
                    <TableCell>Название</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell>Файл</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>{file.sort_order}</TableCell>

                      <TableCell>{file.title}</TableCell>

                      <TableCell
                        sx={{
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.description || "—"}
                      </TableCell>

                      <TableCell>
                        {file.file_url ? (
                          <a
                            href={getUploadUrl(file.file_url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={file.is_active ? "Активен" : "Скрыт"}
                          size="small"
                          color={file.is_active ? "success" : "default"}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(file)}>
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(file.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredFiles.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          Файлы не найдены
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
            {editing ? "Редактировать файл" : "Добавить файл"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="Раздел"
              value={title}
              fullWidth
              InputProps={{ readOnly: true }}
            />

            <TextField
              label="Название документа"
              value={form.title}
              fullWidth
              required
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  title: e.target.value,
                }))
              }
            />

            <TextField
              label="Описание"
              value={form.description}
              fullWidth
              multiline
              rows={3}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
              helperText="Необязательно"
            />

            <TextField
              label="URL файла"
              value={form.file_url}
              fullWidth
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  file_url: e.target.value,
                }))
              }
              helperText="Вставьте прямую ссылку на файл"
              placeholder="https://..."
            />

            <TextField
              label="Порядок отображения"
              type="number"
              value={form.sort_order}
              helperText="Меньшее число — выше в списке"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sort_order: parseInt(e.target.value, 10) || 0,
                }))
              }
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
              disabled={saving || !form.title}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}