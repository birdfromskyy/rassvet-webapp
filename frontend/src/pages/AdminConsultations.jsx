import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  DeleteSweep as AnonymizeIcon,
  DeleteForever as HardDeleteIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import consultationService from "../services/consultationService";

import "./AdminModule.scss";

const MODULE_TITLE = "Заявки на консультацию";

const STATUS_META = {
  new: { label: "Новая", color: "warning" },
  contacted: { label: "Связались", color: "info" },
  closed: { label: "Закрыта", color: "default" },
};

const STATUS_OPTIONS = [
  { value: "new", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "closed", label: "Закрыта" },
];

const CONTACT_LABELS = {
  phone: "Звонок",
  vk: "ВКонтакте",
  max: "MAX",
  email: "Email",
};

const contactDetail = (request) => {
  if (request.contact_method === "email" && request.contact_email) {
    return `Email: ${request.contact_email}`;
  }

  if (request.contact_method === "vk" && request.contact_email) {
    return `VK: ${request.contact_email}`;
  }

  return null;
};

const getRequestAge = (createdAt) => {
  if (!createdAt) return "—";

  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86400000
  );

  if (days <= 0) return "сегодня";
  if (days === 1) return "1 день";

  return `${days} дн.`;
};

export default function AdminConsultations() {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState({
    open: false,
    item: null,
  });

  const [editStatus, setEditStatus] = useState("new");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await consultationService.adminList());
    } catch {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = (item) => {
    setDialog({
      open: true,
      item,
    });

    setEditStatus(item.status);
    setEditNote(item.admin_note || "");
  };

  const closeDialog = () => {
    setDialog({
      open: false,
      item: null,
    });
  };

  const handleSave = async () => {
    if (!dialog.item) return;

    setSaving(true);

    try {
      await consultationService.adminUpdate(dialog.item.id, {
        status: editStatus,
        admin_note: editNote,
      });

      toast.success("Обновлено");
      closeDialog();
      load();
    } catch {
      toast.error("Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleAnonymize = async (id) => {
    if (
      !window.confirm(
        "Удалить персональные данные заявки?\nСтатус и запись сохранятся в БД."
      )
    ) {
      return;
    }

    try {
      await consultationService.adminAnonymize(id);
      toast.success("Данные очищены");
      load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "ПОЛНОЕ удаление записи из БД без возможности восстановления."
      )
    ) {
      return;
    }

    try {
      await consultationService.adminDelete(id);
      toast.success("Заявка удалена");
      load();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const q = search.toLowerCase().trim();

  const filtered = q
    ? list.filter((request) =>
        [
          request.parent_fio,
          request.child_fio,
          request.phone,
          request.contact_email,
          request.request_text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : list;

  const newCount = list.filter((request) => request.status === "new").length;
  const contactedCount = list.filter(
    (request) => request.status === "contacted"
  ).length;
  const closedCount = list.filter(
    (request) => request.status === "closed"
  ).length;

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CRM</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление заявками на консультацию, статусами обработки,
              контактными данными родителей и внутренними заметками
              администратора.
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
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat">
            <span>Всего заявок</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Новые</span>
            <strong>{newCount}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Связались</span>
            <strong>{contactedCount}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Закрытые</span>
            <strong>{closedCount}</strong>
          </div>
        </div>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по ФИО, телефону или email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filtered.length}
            </span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              Заявок нет
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Дата</TableCell>
                    <TableCell>Возраст</TableCell>
                    <TableCell>Родитель</TableCell>
                    <TableCell>Телефон</TableCell>
                    <TableCell>Ребёнок / возраст</TableCell>
                    <TableCell>Связь</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filtered.map((request) => {
                    const meta = STATUS_META[request.status] || {
                      label: request.status,
                      color: "default",
                    };

                    return (
                      <TableRow key={request.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {new Date(request.created_at).toLocaleDateString(
                            "ru-RU"
                          )}
                        </TableCell>

                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {getRequestAge(request.created_at)}
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {request.parent_fio || "—"}
                          </Typography>

                          {request.user_id && (
                            <Typography variant="caption" color="text.secondary">
                              авторизован
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>{request.phone || "—"}</TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {request.child_fio || "—"}
                          </Typography>

                          <Typography variant="caption" color="text.secondary">
                            {request.child_age || "—"}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {CONTACT_LABELS[request.contact_method] ||
                            request.contact_method ||
                            "—"}

                          {contactDetail(request) && (
                            <Typography
                              variant="caption"
                              display="block"
                              color="text.secondary"
                            >
                              {contactDetail(request)}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={meta.label}
                            color={meta.color}
                            size="small"
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Box
                            display="flex"
                            justifyContent="flex-end"
                            gap={1}
                            flexWrap="wrap"
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openDialog(request)}
                            >
                              Открыть
                            </Button>

                            <Tooltip title="Удалить ПД, запись сохраняется">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<AnonymizeIcon />}
                                onClick={() => handleAnonymize(request.id)}
                              >
                                Очистить
                              </Button>
                            </Tooltip>

                            <Tooltip title="Полностью удалить из БД">
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<HardDeleteIcon />}
                                onClick={() => handleDelete(request.id)}
                              >
                                Удалить
                              </Button>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        <Dialog
          open={dialog.open}
          onClose={closeDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            className: "admin-module-dialog",
          }}
        >
          <DialogTitle className="admin-module-dialog__title">
            Заявка от {dialog.item?.parent_fio || "родителя"}
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <div className="admin-request-card">
              <Typography variant="caption">
                <b>Дата:</b>{" "}
                {dialog.item?.created_at
                  ? new Date(dialog.item.created_at).toLocaleString("ru-RU")
                  : "—"}
              </Typography>

              <Typography variant="caption">
                <b>Родитель:</b> {dialog.item?.parent_fio || "—"}
              </Typography>

              <Typography variant="caption">
                <b>Телефон:</b> {dialog.item?.phone || "—"}
              </Typography>

              <Typography variant="caption">
                <b>Ребёнок:</b> {dialog.item?.child_fio || "—"}
                {dialog.item?.child_age ? `, ${dialog.item.child_age}` : ""}
              </Typography>

              <Typography variant="caption">
                <b>Способ связи:</b>{" "}
                {CONTACT_LABELS[dialog.item?.contact_method] ||
                  dialog.item?.contact_method ||
                  "—"}
                {dialog.item &&
                  contactDetail(dialog.item) &&
                  ` — ${contactDetail(dialog.item)}`}
              </Typography>
            </div>

            {dialog.item?.request_text && (
              <div className="admin-request-card admin-request-card--light">
                <Typography variant="caption" color="text.secondary">
                  Обращение:
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {dialog.item.request_text}
                </Typography>
              </div>
            )}

            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>

              <Select
                value={editStatus}
                label="Статус"
                onChange={(event) => setEditStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Заметки"
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
              fullWidth
              multiline
              rows={4}
              helperText="Внутренние заметки, родитель их не видит"
            />
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={closeDialog}>Отмена</Button>

            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}
