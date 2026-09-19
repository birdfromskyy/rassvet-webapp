import "./AdminModule.scss";
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
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import vacancyService from "../services/vacancyService";

const EMPTY = {
  title: "",
  education: "",
  experience: "",
  requirements: "",
  duties: "",
  qualities: "",
  conditions: "",
  contact_phone: "",
  contact_name: "",
  contact_messengers: "",
  is_active: true,
  sort_order: 0,
};

const parseLines = (str) => {
  try {
    return JSON.parse(str || "[]").join("\n");
  } catch {
    return str || "";
  }
};

const toJsonLines = (str) =>
  JSON.stringify(
    str
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  );

const AdminVacancies = () => {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setVacancies(await vacancyService.adminGetAll());
    } catch {
      toast.error("Ошибка загрузки вакансий");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ ...EMPTY, sort_order: vacancies.length });
    setDialog({ open: true, item: null });
  };

  const openEdit = (item) => {
    setForm({
      title: item.title,
      education: parseLines(item.education),
      experience: parseLines(item.experience),
      requirements: parseLines(item.requirements),
      duties: parseLines(item.duties),
      qualities: parseLines(item.qualities),
      conditions: parseLines(item.conditions),
      contact_phone: item.contact_phone || "",
      contact_name: item.contact_name || "",
      contact_messengers: item.contact_messengers || "",
      is_active: item.is_active,
      sort_order: item.sort_order ?? 0,
    });
    setDialog({ open: true, item });
  };

  const close = () => setDialog({ open: false, item: null });

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Введите название вакансии");
      return;
    }
    try {
      const data = {
        title: form.title.trim(),
        education: toJsonLines(form.education),
        experience: toJsonLines(form.experience),
        requirements: toJsonLines(form.requirements),
        duties: toJsonLines(form.duties),
        qualities: toJsonLines(form.qualities),
        conditions: toJsonLines(form.conditions),
        contact_phone: form.contact_phone.trim(),
        contact_name: form.contact_name.trim(),
        contact_messengers: form.contact_messengers.trim(),
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (dialog.item) {
        await vacancyService.adminUpdate(dialog.item.id, data);
        toast.success("Вакансия обновлена");
      } else {
        await vacancyService.adminCreate(data);
        toast.success("Вакансия создана");
      }
      close();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Удалить вакансию безвозвратно?")) return;
    try {
      await vacancyService.adminDelete(id);
      toast.success("Вакансия удалена");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка удаления");
    }
  };

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>
            <h1>Вакансии</h1>
            <p>
              Управление карточками вакансий, требованиями, обязанностями и
              контактной информацией для раздела трудоустройства.
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
              href="/vacancies"
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
              Добавить
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Поиск по вакансиям..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                    <TableCell>ID</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Телефон</TableCell>
                    <TableCell>Контактное лицо</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vacancies
                    .filter((v) =>
                      v.title.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.id}</TableCell>
                        <TableCell>{v.title}</TableCell>
                        <TableCell>{v.contact_phone || "—"}</TableCell>
                        <TableCell>{v.contact_name || "—"}</TableCell>
                        <TableCell>
                          <Chip
                            label={v.is_active ? "Активна" : "Скрыта"}
                            color={v.is_active ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Редактировать">
                            <IconButton onClick={() => openEdit(v)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              onClick={() => remove(v.id)}
                              size="small"
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  {!vacancies.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          Вакансии не найдены
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
          open={dialog.open}
          onClose={close}
          maxWidth="md"
          fullWidth
          PaperProps={{ className: "admin-module-dialog" }}
        >
          <DialogTitle className="admin-module-dialog__title">
            {dialog.item ? "Редактировать вакансию" : "Новая вакансия"}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <TextField
              label="Название вакансии"
              value={form.title}
              onChange={f("title")}
              fullWidth
              required
            />

            <TextField
              label="Образование (каждая строка — отдельный пункт)"
              value={form.education}
              onChange={f("education")}
              fullWidth
              multiline
              rows={3}
              placeholder={"Высшее образование — бакалавриат.\nСреднее профессиональное образование."}
            />

            <TextField
              label="Опыт (каждая строка — отдельный пункт)"
              value={form.experience}
              onChange={f("experience")}
              fullWidth
              multiline
              rows={2}
              placeholder="Требования к опыту практической работы не предъявляются."
            />

            <TextField
              label="Особые требования (каждая строка — отдельный пункт)"
              value={form.requirements}
              onChange={f("requirements")}
              fullWidth
              multiline
              rows={3}
              placeholder={"Отсутствие судимости за преступления...\nНаличие медицинской книжки."}
            />

            <TextField
              label="Должностные обязанности (каждая строка — отдельный пункт)"
              value={form.duties}
              onChange={f("duties")}
              fullWidth
              multiline
              rows={4}
              placeholder={"Проведение индивидуальных занятий с детьми.\nПсихологическая диагностика."}
            />

            <TextField
              label="Пожелания к личным качествам (каждая строка — отдельный пункт)"
              value={form.qualities}
              onChange={f("qualities")}
              fullWidth
              multiline
              rows={3}
              placeholder={"Аккуратность.\nОтветственность.\nПунктуальность."}
            />

            <TextField
              label="Условия работы (каждая строка — отдельный пункт)"
              value={form.conditions}
              onChange={f("conditions")}
              fullWidth
              multiline
              rows={3}
              placeholder={"Гибкий график.\nОфициальное трудоустройство.\nБесплатное питание."}
            />

            <Box display="flex" gap={2}>
              <TextField
                label="Телефон"
                value={form.contact_phone}
                onChange={f("contact_phone")}
                fullWidth
                placeholder="+7 (904) 459-31-02"
              />
              <TextField
                label="Контактное лицо (Имя Отчество)"
                value={form.contact_name}
                onChange={f("contact_name")}
                fullWidth
                placeholder="Оксана Александровна"
              />
            </Box>

            <TextField
              label="Мессенджеры (необязательно)"
              value={form.contact_messengers}
              onChange={f("contact_messengers")}
              fullWidth
              placeholder="MAX, Telegram"
              helperText="Укажите через запятую, например: MAX, Telegram, WhatsApp"
            />

            <Box display="flex" gap={3} alignItems="center">
              <TextField
                label="Порядок сортировки"
                type="number"
                value={form.sort_order}
                onChange={f("sort_order")}
                sx={{ width: 180 }}
                inputProps={{ min: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />
                }
                label="Показывать на сайте"
              />
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={close}>Отмена</Button>
            <Button onClick={save} variant="contained">
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
};

export default AdminVacancies;
