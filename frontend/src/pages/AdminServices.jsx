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
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { serviceCmsService } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Услуги";

const TYPES = {
  services_list: "services_list",
  about_services: "about_services",
};

const emptyForm = (type) => ({
  parent_id: "",
  title: "",
  text: "",
  items: "",
  sort_order: 0,
  is_active: true,
  type,
});

const getPublicPageUrl = (type) => {
  if (type === TYPES.services_list) return "/services-list";
  return "/services-description";
};

export default function AdminServices() {
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const currentType = tab === 0 ? TYPES.services_list : TYPES.about_services;

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(TYPES.services_list));
  const [itemsText, setItemsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const publicPageUrl = getPublicPageUrl(currentType);

  const load = (type) => {
    setLoading(true);
    serviceCmsService
      .getAllAdmin(type)
      .then(setServices)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(currentType);
  }, [currentType]);

  const topLevel = services.filter((service) => !service.parent_id);

  const parseItems = (str) => {
    try {
      return JSON.parse(str || "[]");
    } catch {
      return [];
    }
  };

  const filteredServices = services.filter((service) => {
    const value = `${service.title} ${service.text || ""} ${parseItems(
      service.items
    ).join(" ")}`.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(currentType), sort_order: services.length });
    setItemsText("");
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);

    setForm({
      parent_id: item.parent_id ?? "",
      title: item.title,
      text: item.text || "",
      sort_order: item.sort_order,
      is_active: item.is_active,
      type: item.type,
    });

    try {
      setItemsText(JSON.parse(item.items || "[]").join("\n"));
    } catch {
      setItemsText("");
    }

    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Введите название");
      return;
    }

    setSaving(true);

    try {
      const itemsJson = JSON.stringify(
        itemsText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
      );

      const data = {
        ...form,
        parent_id: form.parent_id === "" ? null : Number(form.parent_id),
        items: itemsJson,
        sort_order: Number(form.sort_order) || 0,
        type: currentType,
      };

      if (editing) {
        await serviceCmsService.update(editing.id, data);
        toast.success("Услуга обновлена");
      } else {
        await serviceCmsService.create(data);
        toast.success("Услуга создана");
      }

      handleClose();
      load(currentType);
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить запись?")) return;

    try {
      await serviceCmsService.delete(id);
      toast.success("Удалено");
      load(currentType);
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const f = (key) => (e) =>
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));

  const parentName = (id) => {
    if (!id) return "—";
    return services.find((service) => service.id === id)?.title || String(id);
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление перечнем и описанием услуг Центра: разделы, карточки,
              подробные описания, пункты списка, порядок отображения и статус
              публикации.
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
              Добавить услугу
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <Tabs
            value={tab}
            onChange={(_, value) => {
              setTab(value);
              setSearch("");
            }}
            className="admin-module__tabs"
          >
            <Tab label="Перечень услуг" />
            <Tab label="Описание услуг" />
          </Tabs>

          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по услугам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredServices.length}
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
                    {currentType === TYPES.services_list && (
                      <TableCell>Раздел</TableCell>
                    )}
                    <TableCell>Название</TableCell>
                    <TableCell>Текст</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow
                      key={service.id}
                      sx={
                        service.parent_id
                          ? { backgroundColor: "rgba(7, 68, 98, 0.03)" }
                          : {}
                      }
                    >
                      <TableCell>{service.sort_order}</TableCell>

                      {currentType === TYPES.services_list && (
                        <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>
                          {service.parent_id ? (
                            parentName(service.parent_id)
                          ) : (
                            <strong>— раздел —</strong>
                          )}
                        </TableCell>
                      )}

                      <TableCell sx={{ pl: service.parent_id ? 4 : 1 }}>
                        {service.title}
                      </TableCell>

                      <TableCell
                        sx={{
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {service.text || "—"}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={service.is_active ? "Активна" : "Скрыта"}
                          color={service.is_active ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>

                      <TableCell align="center">
                        <IconButton size="small" onClick={() => openEdit(service)}>
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(service.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredServices.length && (
                    <TableRow>
                      <TableCell
                        colSpan={currentType === TYPES.services_list ? 6 : 5}
                        align="center"
                      >
                        <Typography color="text.secondary">
                          Услуги не найдены
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
          onClose={handleClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            className: "admin-module-dialog",
          }}
        >
          <DialogTitle className="admin-module-dialog__title">
            {editing ? "Редактировать услугу" : "Новая услуга"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            {currentType === TYPES.services_list && (
              <FormControl fullWidth>
                <InputLabel>Раздел</InputLabel>

                <Select
                  value={form.parent_id}
                  label="Раздел"
                  onChange={f("parent_id")}
                >
                  <MenuItem value="">
                    — верхний уровень / раздел —
                  </MenuItem>

                  {topLevel
                    .filter((service) => !editing || service.id !== editing.id)
                    .map((service) => (
                      <MenuItem key={service.id} value={service.id}>
                        {service.title}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Название"
              value={form.title}
              onChange={f("title")}
              fullWidth
              required
              multiline
              rows={2}
            />

            <TextField
              label="Описание"
              value={form.text}
              onChange={f("text")}
              fullWidth
              multiline
              rows={3}
            />

            <TextField
              label="Пункты списка"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              fullWidth
              multiline
              rows={5}
              placeholder={"Пункт 1\nПункт 2\nПункт 3"}
              helperText="Каждая строка — отдельный пункт"
            />

            <TextField
              label="Порядок сортировки"
              type="number"
              value={form.sort_order}
              onChange={f("sort_order")}
              inputProps={{ min: 0 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={!!form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
              }
              label="Показывать на сайте"
            />
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={handleClose}>Отмена</Button>

            <Button
              onClick={handleSave}
              variant="contained"
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