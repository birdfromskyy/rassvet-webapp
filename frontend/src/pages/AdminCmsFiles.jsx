import React, { useState, useEffect, useCallback } from "react";
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { cmsFileGroupService, cmsFileService, getUploadUrl } from "../services/cmsService";

import "./AdminModule.scss";

const emptyForm = {
  title: "",
  file_url: "",
  sort_order: 0,
  is_active: true,
  group_id: "",
};

const emptyGroupForm = { title: "", sort_order: 0, is_active: true };

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
  const [groups, setGroups] = useState([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [groupSaving, setGroupSaving] = useState(false);

  const publicPageUrl = getPublicPageUrl(section);

  const filteredFiles = files.filter((file) => {
    const value = `${file.title} ${file.file_url || ""}`.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  const load = useCallback(() => {
    setLoading(true);
    const fileRequest = cmsFileService.getAllAdmin(section);
    const groupRequest = section === "rating" ? cmsFileGroupService.getAllAdmin(section) : Promise.resolve([]);
    Promise.all([fileRequest, groupRequest])
      .then(([loadedFiles, loadedGroups]) => {
        setFiles(loadedFiles);
        setGroups(loadedGroups);
      })
      .finally(() => setLoading(false));
  }, [section]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: files.length, group_id: "" });
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
      const payload = { ...form, section, group_id: form.group_id || null };

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

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ ...emptyGroupForm, sort_order: groups.length });
    setGroupOpen(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({ title: group.title, sort_order: group.sort_order, is_active: group.is_active });
    setGroupOpen(true);
  };

  const saveGroup = async () => {
    if (!groupForm.title.trim()) return;
    setGroupSaving(true);
    try {
      const payload = { ...groupForm, section, title: groupForm.title.trim() };
      if (editingGroup) await cmsFileGroupService.update(editingGroup.id, payload);
      else await cmsFileGroupService.create(payload);
      setGroupOpen(false);
      load();
    } catch (error) {
      alert(error.response?.data?.error || "Не удалось сохранить раздел");
    } finally {
      setGroupSaving(false);
    }
  };

  const deleteGroup = async (group) => {
    if (!window.confirm(`Удалить раздел «${group.title}»?`)) return;
    try {
      await cmsFileGroupService.delete(group.id);
      load();
    } catch (error) {
      alert(error.response?.data?.error || "Сначала перенесите файлы из раздела");
    }
  };

  const groupName = (groupId) => groups.find((group) => group.id === groupId)?.title || "Без раздела";

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
          {section === "rating" && (
            <div className="admin-cms-groups">
              <div className="admin-cms-groups__head">
                <h2>Разделы документов</h2>
                <Button startIcon={<AddIcon />} onClick={openCreateGroup} className="admin-module__button admin-module__button--primary">
                  Добавить раздел
                </Button>
              </div>
              {groups.length ? (
                <TableContainer className="admin-cms-groups__table">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={120}>Порядок</TableCell>
                        <TableCell>Название раздела</TableCell>
                        <TableCell width={170}>Статус</TableCell>
                        <TableCell width={130} align="right">Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell>{group.sort_order}</TableCell>
                          <TableCell>{group.title}</TableCell>
                          <TableCell>
                            <Chip
                              label={group.is_active ? "Активен" : "Скрыт"}
                              size="small"
                              color={group.is_active ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => openEditGroup(group)} aria-label={`Редактировать раздел ${group.title}`}>
                              <EditIcon />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteGroup(group)} aria-label={`Удалить раздел ${group.title}`}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <p className="admin-cms-groups__empty">Разделы пока не добавлены.</p>
              )}
            </div>
          )}
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
                    {section === "rating" && <TableCell>Раздел</TableCell>}
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

                      {section === "rating" && <TableCell>{groupName(file.group_id)}</TableCell>}

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
                      <TableCell colSpan={section === "rating" ? 6 : 5} align="center">
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
              label="Страница сайта"
              value={title}
              fullWidth
              InputProps={{ readOnly: true }}
            />

            {section === "rating" && (
              <FormControl fullWidth>
                <InputLabel>Группа документов</InputLabel>
                <Select
                  label="Группа документов"
                  value={form.group_id || ""}
                  onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value === "" ? "" : Number(e.target.value) }))}
                >
                  <MenuItem value=""><em>Без раздела</em></MenuItem>
                  {groups.map((group) => <MenuItem key={group.id} value={group.id}>{group.title}{group.is_active ? "" : " (скрыт)"}</MenuItem>)}
                </Select>
              </FormControl>
            )}

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

        {section === "rating" && (
          <Dialog open={groupOpen} onClose={() => setGroupOpen(false)} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
            <DialogTitle className="admin-module-dialog__title">{editingGroup ? "Редактировать раздел" : "Новый раздел"}</DialogTitle>
            <DialogContent className="admin-module-dialog__content">
              <TextField label="Название раздела" value={groupForm.title} fullWidth required onChange={(e) => setGroupForm((form) => ({ ...form, title: e.target.value }))} placeholder="Например, 2025 или Основные документы" />
              <TextField label="Порядок отображения" type="number" value={groupForm.sort_order} fullWidth helperText="Меньшее число — выше на странице" onChange={(e) => setGroupForm((form) => ({ ...form, sort_order: parseInt(e.target.value, 10) || 0 }))} />
              <FormControlLabel control={<Switch checked={groupForm.is_active} onChange={(e) => setGroupForm((form) => ({ ...form, is_active: e.target.checked }))} />} label="Отображать раздел и его файлы на сайте" />
            </DialogContent>
            <DialogActions className="admin-module-dialog__actions"><Button onClick={() => setGroupOpen(false)}>Отмена</Button><Button variant="contained" disabled={groupSaving || !groupForm.title.trim()} onClick={saveGroup}>{groupSaving ? "Сохранение..." : "Сохранить"}</Button></DialogActions>
          </Dialog>
        )}
      </div>
    </main>
  );
}
