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
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { historyService } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "История и достижения";
const PUBLIC_PAGE_URL = "/history";

const emptyForm = {
  year: "",
  items: "",
  sort_order: 0,
};

export default function AdminHistory() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [itemsText, setItemsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    historyService.getAll().then(setEvents).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: events.length });
    setItemsText("");
    setOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      year: event.year,
      sort_order: event.sort_order,
    });

    try {
      setItemsText(JSON.parse(event.items || "[]").join("\n"));
    } catch {
      setItemsText("");
    }

    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const items = JSON.stringify(
        itemsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      );

      const payload = {
        year: form.year,
        items,
        sort_order: form.sort_order,
      };

      if (editing) {
        await historyService.update(editing.id, payload);
      } else {
        await historyService.create(payload);
      }

      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить запись?")) return;

    await historyService.delete(id);
    load();
  };

  const parseItems = (str) => {
    try {
      return JSON.parse(str || "[]");
    } catch {
      return [];
    }
  };

  const filteredEvents = events.filter((event) => {
    const items = parseItems(event.items).join(" ");

    const value = `${event.year} ${items}`.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление временной шкалой Центра: годы, ключевые события,
              достижения и важные этапы развития организации.
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
              Добавить год
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по истории..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredEvents.length}
            </span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={90}>Порядок</TableCell>
                    <TableCell width={120}>Год</TableCell>
                    <TableCell>Достижения</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.sort_order}</TableCell>

                      <TableCell>
                        <strong>{event.year}</strong>
                      </TableCell>

                      <TableCell>
                        <ul className="admin-module__list">
                          {parseItems(event.items).map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </TableCell>

                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(event)}>
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(event.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredEvents.length && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary">
                          Записи не найдены
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
            {editing ? "Редактировать год" : "Добавить год"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="Год"
              value={form.year}
              fullWidth
              required
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  year: e.target.value,
                }))
              }
              helperText="Например: 2025"
            />

            <TextField
              label="Достижения"
              value={itemsText}
              fullWidth
              multiline
              rows={7}
              onChange={(e) => setItemsText(e.target.value)}
              helperText="Каждая строка — отдельное достижение"
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
            />
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)}>Отмена</Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !form.year}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}