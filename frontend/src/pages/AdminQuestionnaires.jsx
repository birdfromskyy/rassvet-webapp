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
  Download as DownloadIcon,
  DeleteSweep as AnonymizeIcon,
  DeleteForever as HardDeleteIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";

import questionnaireService from "../services/questionnaireService";

import "./AdminModule.scss";

const MODULE_TITLE = "Анкеты родителей";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080/api";

const downloadQuestionnaireFile = async (id, filename) => {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/admin/questionnaires/${id}/file`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Ошибка загрузки");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `questionnaire_${id}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch {
    toast.error("Не удалось скачать файл");
  }
};

const STATUS_META = {
  pending: {
    label: "На проверке",
    color: "warning",
  },
  approved: {
    label: "Принята",
    color: "success",
  },
  rejected: {
    label: "Отклонена",
    color: "error",
  },
};

export default function AdminQuestionnaires() {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState({
    open: false,
    item: null,
  });

  const [editStatus, setEditStatus] = useState("pending");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await questionnaireService.adminList());
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

  const handleAnonymize = async (id) => {
    if (
      !window.confirm(
        "Удалить файл анкеты и персональные данные?\nЗапись о статусе будет сохранена в БД."
      )
    ) {
      return;
    }

    try {
      await questionnaireService.adminAnonymize(id);
      toast.success("Персональные данные удалены, запись сохранена");
      load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "ПОЛНОЕ удаление: запись, файл и все данные будут удалены из БД без возможности восстановления."
      )
    ) {
      return;
    }

    try {
      await questionnaireService.adminDelete(id);
      toast.success("Запись удалена полностью");
      load();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await questionnaireService.adminUpdateStatus(
        dialog.item.id,
        editStatus,
        editNote
      );

      toast.success("Статус обновлён");

      setDialog({
        open: false,
        item: null,
      });

      load();
    } catch {
      toast.error("Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredList = normalizedSearch
    ? list.filter((item) => {
        const fullName = [item.user_last_name, item.user_first_name]
          .filter(Boolean)
          .join(" ");

        const value = `
          ${fullName}
          ${item.user_email || ""}
          ${item.file_name || ""}
          ${item.status || ""}
          ${item.id || ""}
        `.toLowerCase();

        return value.includes(normalizedSearch);
      })
    : list;

  const pendingCount = list.filter((item) => item.status === "pending").length;
  const approvedCount = list.filter((item) => item.status === "approved").length;
  const rejectedCount = list.filter((item) => item.status === "rejected").length;

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Документооборот</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Проверка входных анкет родителей, принятие решений по заявкам,
              скачивание файлов и безопасное удаление персональных данных.
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
            <span>Всего анкет</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>На проверке</span>
            <strong>{pendingCount}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Принято</span>
            <strong>{approvedCount}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Отклонено</span>
            <strong>{rejectedCount}</strong>
          </div>
        </div>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по ФИО, email, файлу или статусу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredList.length}
            </span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredList.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              Анкеты не найдены
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Пользователь</TableCell>
                  <TableCell>Файл</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredList.map((item) => {
                  const meta = STATUS_META[item.status] || {
                    label: item.status,
                    color: "default",
                  };

                  const fullName = [
                    item.user_last_name,
                    item.user_first_name,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {new Date(item.created_at).toLocaleDateString("ru-RU")}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {fullName || "—"}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          {item.user_email}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={() =>
                            downloadQuestionnaireFile(item.id, item.file_name)
                          }
                          disabled={!item.file_name}
                        >
                          Скачать
                        </Button>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={meta.label}
                          color={meta.color}
                          size="small"
                        />

                        {item.admin_note && (
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {item.admin_note}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Box
                          display="flex"
                          gap={1}
                          flexWrap="wrap"
                          justifyContent="flex-end"
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openDialog(item)}
                          >
                            Решение
                          </Button>

                          <Tooltip title="Удалить файл и ПД, запись сохраняется">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<AnonymizeIcon />}
                                onClick={() => handleAnonymize(item.id)}
                                disabled={!item.file_name}
                              >
                                Очистить
                              </Button>
                            </span>
                          </Tooltip>

                          <Tooltip title="Полностью удалить из БД">
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<HardDeleteIcon />}
                              onClick={() => handleDelete(item.id)}
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
          )}
        </section>

        <Dialog
          open={dialog.open}
          onClose={() =>
            setDialog({
              open: false,
              item: null,
            })
          }
          maxWidth="sm"
          fullWidth
          PaperProps={{
            className: "admin-module-dialog",
          }}
        >
          <DialogTitle className="admin-module-dialog__title">
            Решение по анкете
          </DialogTitle>

          <DialogContent className="admin-module-dialog__content">
            <Box className="admin-module-dialog__info">
              <Typography variant="body2">
                <strong>Пользователь:</strong>{" "}
                {[dialog.item?.user_last_name, dialog.item?.user_first_name]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </Typography>

              <Typography variant="body2">
                <strong>Email:</strong> {dialog.item?.user_email || "—"}
              </Typography>

              <Typography variant="body2">
                <strong>Файл:</strong> {dialog.item?.file_name || "—"}
              </Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>

              <Select
                value={editStatus}
                label="Статус"
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <MenuItem value="pending">На проверке</MenuItem>
                <MenuItem value="approved">
                  Принята / разрешить подачу документов
                </MenuItem>
                <MenuItem value="rejected">Требует уточнения</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Примечание для пользователя"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              fullWidth
              multiline
              rows={4}
              helperText="При отклонении это сообщение будет показано пользователю в уведомлении"
            />
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button
              onClick={() =>
                setDialog({
                  open: false,
                  item: null,
                })
              }
            >
              Отмена
            </Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Сохранение..." : "Применить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}
