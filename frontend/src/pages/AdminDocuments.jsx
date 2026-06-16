import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  ExpandMore as ExpandIcon,
  OpenInNew as OpenIcon,
  HourglassTop as PendingIcon,
  DeleteSweep as AnonymizeIcon,
  DeleteForever as HardDeleteIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import documentService from "../services/documentService";

import "./AdminModule.scss";

const MODULE_TITLE = "Документы родителей";

const safeParseJSON = (str) => {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
};

const formatPhone = (raw) => {
  if (!raw) return "—";

  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 11) return raw;

  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(
    7,
    9
  )} ${digits.slice(9, 11)}`;
};

const STATUS_META = {
  draft: { label: "Черновик", color: "default" },
  pending: { label: "На проверке", color: "warning" },
  approved: { label: "Принято", color: "success" },
  rejected: { label: "Отклонено", color: "error" },
};

const CHILD_STATUS_OPTIONS = [
  { value: "pending", label: "На проверке" },
  { value: "approved", label: "Принято" },
  { value: "rejected", label: "Отклонено" },
];

const PARENT_STATUS_OPTIONS = [
  { value: "pending", label: "На проверке" },
  { value: "approved", label: "Принято" },
  { value: "rejected", label: "Отклонено" },
];

const StatusChip = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, color: "default" };

  return <Chip label={meta.label} color={meta.color} size="small" />;
};

const openPrivateFile = (filename) => {
  const base = process.env.REACT_APP_API_URL || "http://localhost:8080/api";
  window.open(`${base}/documents/file/${filename}`, "_blank");
};

const FileLinks = ({ files }) => {
  const list = safeParseJSON(files);

  if (list.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        не загружено
      </Typography>
    );
  }

  return (
    <Box display="flex" flexWrap="wrap" gap={0.5}>
      {list.map((filename) => (
        <Chip
          key={filename}
          label={filename.slice(0, 22) + (filename.length > 22 ? "…" : "")}
          size="small"
          variant="outlined"
          icon={<OpenIcon fontSize="inherit" />}
          onClick={() => openPrivateFile(filename)}
          sx={{ cursor: "pointer" }}
        />
      ))}
    </Box>
  );
};

const StatusDialog = ({
  open,
  title,
  currentStatus,
  currentNote,
  statusOptions,
  onClose,
  onSave,
}) => {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(currentStatus || statusOptions[0]?.value || "");
      setNote(currentNote || "");
    }
  }, [open, currentStatus, currentNote, statusOptions]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await onSave(status, note);
      toast.success("Статус обновлён");
      onClose();
    } catch {
      toast.error("Ошибка обновления статуса");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: "admin-module-dialog" }}
    >
      <DialogTitle className="admin-module-dialog__title">{title}</DialogTitle>

      <DialogContent className="admin-module-dialog__content">
        <FormControl fullWidth>
          <InputLabel>Статус</InputLabel>
          <Select
            value={status}
            label="Статус"
            onChange={(event) => setStatus(event.target.value)}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Примечание для родителя"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          fullWidth
          multiline
          rows={3}
          helperText="Причина отклонения или комментарий, родитель его видит"
        />
      </DialogContent>

      <DialogActions className="admin-module-dialog__actions">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ChildStatusDialog = ({ open, submission, onClose, onSave }) => {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && submission) {
      setStatus(submission.status || "pending");
      setNote(submission.admin_note || "");
      setExpiryDate(
        submission.ippsu_expiry_date
          ? submission.ippsu_expiry_date.slice(0, 10)
          : ""
      );
    }
  }, [open, submission]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await onSave(status, note, expiryDate);
      toast.success("Статус обновлён");
      onClose();
    } catch {
      toast.error("Ошибка обновления статуса");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: "admin-module-dialog" }}
    >
      <DialogTitle className="admin-module-dialog__title">
        Статус документов: {submission?.child_name || ""}
      </DialogTitle>

      <DialogContent className="admin-module-dialog__content">
        <FormControl fullWidth>
          <InputLabel>Статус</InputLabel>
          <Select
            value={status}
            label="Статус"
            onChange={(event) => setStatus(event.target.value)}
          >
            {CHILD_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {status === "approved" && (
          <TextField
            label="Срок действия ИППСУ"
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Когда срок истечёт — пользователь и администратор получат уведомление на сайте"
          />
        )}

        <TextField
          label="Примечание для родителя"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          fullWidth
          multiline
          rows={3}
          helperText="Причина отклонения или комментарий видит родитель"
        />
      </DialogContent>

      <DialogActions className="admin-module-dialog__actions">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DeleteDialog = ({ open, title, description, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);

    try {
      await onConfirm();
      onClose();
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "admin-module-dialog admin-module-dialog--danger" }}
    >
      <DialogTitle className="admin-module-dialog__title">
        {title}
      </DialogTitle>

      <DialogContent className="admin-module-dialog__content">
        <Typography variant="body2">{description}</Typography>
      </DialogContent>

      <DialogActions className="admin-module-dialog__actions">
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "Удаление..." : "Удалить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AdminDocuments = () => {
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [childDialog, setChildDialog] = useState({
    open: false,
    submission: null,
  });
  const [parentDialog, setParentDialog] = useState({
    open: false,
    userId: null,
    status: "",
    note: "",
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    submission: null,
  });
  const [anonymizeDialog, setAnonymizeDialog] = useState({
    open: false,
    submission: null,
  });
  const [deleteParentDialog, setDeleteParentDialog] = useState({
    open: false,
    userId: null,
    email: "",
  });
  const [anonymizeParentDialog, setAnonymizeParentDialog] = useState({
    open: false,
    userId: null,
    email: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await documentService.adminListDocuments();
      setList(data || []);
    } catch {
      toast.error("Ошибка загрузки документов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = normalizedSearch
    ? list.filter((userDoc) =>
        [userDoc.email, userDoc.full_name, String(userDoc.user_id)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : list;

  const totalChildren = list.reduce(
    (sum, userDoc) => sum + (userDoc.children?.length || 0),
    0
  );
  const pendingChildren = list.reduce(
    (sum, userDoc) =>
      sum + (userDoc.children || []).filter((child) => child.status === "pending").length,
    0
  );
  const approvedChildren = list.reduce(
    (sum, userDoc) =>
      sum + (userDoc.children || []).filter((child) => child.status === "approved").length,
    0
  );

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Документооборот</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Проверка документов родителей и детей, изменение статусов,
              просмотр файлов, контроль срока действия ИППСУ и безопасное
              удаление персональных данных.
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
            <span>Родителей в списке</span>
            <strong>{list.length}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Документов детей</span>
            <strong>{totalChildren}</strong>
          </div>

          <div className="admin-users-stat">
            <span>На проверке</span>
            <strong>{pendingChildren}</strong>
          </div>

          <div className="admin-users-stat">
            <span>Принято</span>
            <strong>{approvedChildren}</strong>
          </div>
        </div>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по email, ФИО или ID..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <span className="admin-module__count">Найдено: {filtered.length}</span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              Документы не найдены
            </Typography>
          ) : (
            filtered.map((userDoc) => {
              const profile = userDoc.parent_profile;
              const children = userDoc.children || [];
              const pendingCount = children.filter(
                (child) => child.status === "pending"
              ).length;

              return (
                <Accordion key={userDoc.user_id} className="admin-docs-accordion">
                  <AccordionSummary expandIcon={<ExpandIcon />}>
                    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                      <Typography fontWeight={700}>
                        {userDoc.full_name || "—"}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {userDoc.email}
                      </Typography>

                      {pendingCount > 0 && (
                        <Chip
                          label={`${pendingCount} на проверке`}
                          color="warning"
                          size="small"
                          icon={<PendingIcon fontSize="inherit" />}
                        />
                      )}
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Документы родителя
                    </Typography>

                    {profile ? (
                      <Box>
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={2}
                          mb={1.5}
                          flexWrap="wrap"
                        >
                          <Typography variant="body2">
                            Телефон: <strong>{formatPhone(profile.phone)}</strong>
                          </Typography>

                          <StatusChip status={profile.status} />

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setParentDialog({
                                open: true,
                                userId: userDoc.user_id,
                                status: profile.status || "pending",
                                note: profile.admin_note || "",
                              })
                            }
                          >
                            Изменить статус
                          </Button>

                          <Tooltip title="Удалить файлы и номер телефона, запись сохраняется">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<AnonymizeIcon />}
                              onClick={() =>
                                setAnonymizeParentDialog({
                                  open: true,
                                  userId: userDoc.user_id,
                                  email: userDoc.email,
                                })
                              }
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
                              onClick={() =>
                                setDeleteParentDialog({
                                  open: true,
                                  userId: userDoc.user_id,
                                  email: userDoc.email,
                                })
                              }
                            >
                              Удалить
                            </Button>
                          </Tooltip>
                        </Box>

                        {profile.admin_note && (
                          <Typography
                            variant="body2"
                            sx={{ mb: 1.5, color: "text.secondary" }}
                          >
                            Примечание: {profile.admin_note}
                          </Typography>
                        )}

                        <div className="admin-docs-files">
                          <div className="admin-docs-file-card">
                            <h3>Паспорт</h3>
                            <FileLinks files={profile.passport_files} />
                          </div>

                          <div className="admin-docs-file-card">
                            <h3>СНИЛС родителя</h3>
                            <FileLinks files={profile.snils_files} />
                          </div>
                        </div>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                        Родитель ещё не заполнил личные документы
                      </Typography>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Документы детей ({children.length})
                    </Typography>

                    {children.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        Документы детей не поданы
                      </Typography>
                    ) : (
                      children.map((child) => (
                        <Box key={child.id} className="admin-docs-child-card">
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={2}
                            mb={1}
                            flexWrap="wrap"
                          >
                            <Typography fontWeight={700}>{child.child_name}</Typography>

                            <StatusChip status={child.status} />

                            {child.ippsu_expiry_date && (
                              <Chip
                                size="small"
                                label={`ИППСУ до: ${new Date(
                                  child.ippsu_expiry_date
                                ).toLocaleDateString("ru-RU")}`}
                                color={
                                  new Date(child.ippsu_expiry_date) < new Date()
                                    ? "error"
                                    : "default"
                                }
                                variant="outlined"
                              />
                            )}

                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setChildDialog({ open: true, submission: child })
                              }
                            >
                              Изменить статус
                            </Button>

                            <Tooltip title="Удалить файлы и персональные данные, запись сохраняется">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<AnonymizeIcon />}
                                onClick={() =>
                                  setAnonymizeDialog({
                                    open: true,
                                    submission: child,
                                  })
                                }
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
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    submission: child,
                                  })
                                }
                              >
                                Удалить
                              </Button>
                            </Tooltip>
                          </Box>

                          {child.admin_note && (
                            <Typography
                              variant="body2"
                              sx={{ mb: 1, color: "text.secondary" }}
                            >
                              Примечание: {child.admin_note}
                            </Typography>
                          )}

                          <div className="admin-docs-files admin-docs-files--child">
                            <div className="admin-docs-file-card">
                              <h3>ИППСУ</h3>
                              <FileLinks files={child.ippsu_files} />
                            </div>

                            <div className="admin-docs-file-card">
                              <h3>Свидетельство о рождении</h3>
                              <FileLinks files={child.birth_cert_files} />
                            </div>

                            <div className="admin-docs-file-card">
                              <h3>СНИЛС ребёнка</h3>
                              <FileLinks files={child.child_snils_files} />
                            </div>
                          </div>
                        </Box>
                      ))
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </section>

        <ChildStatusDialog
          open={childDialog.open}
          submission={childDialog.submission}
          onClose={() => setChildDialog({ open: false, submission: null })}
          onSave={(status, note, expiryDate) =>
            documentService
              .adminUpdateSubmissionStatus(
                childDialog.submission.id,
                status,
                note,
                expiryDate
              )
              .then(load)
          }
        />

        <StatusDialog
          open={parentDialog.open}
          title="Статус документов родителя"
          currentStatus={parentDialog.status}
          currentNote={parentDialog.note}
          statusOptions={PARENT_STATUS_OPTIONS}
          onClose={() => setParentDialog({ open: false, userId: null, status: "", note: "" })}
          onSave={(status, note) =>
            documentService.adminUpdateParentStatus(parentDialog.userId, status, note).then(load)
          }
        />

        <DeleteDialog
          open={anonymizeDialog.open}
          title="Очистить персональные данные"
          description={`Файлы и персональные данные заявки «${
            anonymizeDialog.submission?.child_name || ""
          }» будут удалены. Запись о заявке и её статус сохранятся в БД.`}
          onClose={() => setAnonymizeDialog({ open: false, submission: null })}
          onConfirm={() =>
            documentService.adminAnonymizeSubmission(anonymizeDialog.submission.id).then(
              () => {
                toast.success("Данные очищены, запись сохранена");
                load();
              }
            )
          }
        />

        <DeleteDialog
          open={deleteDialog.open}
          title="Полностью удалить заявку"
          description={`Заявка «${
            deleteDialog.submission?.child_name || ""
          }» и все её файлы будут полностью удалены из БД без возможности восстановления.`}
          onClose={() => setDeleteDialog({ open: false, submission: null })}
          onConfirm={() =>
            documentService.adminDeleteSubmission(deleteDialog.submission.id).then(() => {
              toast.success("Заявка удалена");
              load();
            })
          }
        />

        <DeleteDialog
          open={anonymizeParentDialog.open}
          title="Очистить данные родителя"
          description={`Файлы паспорта, СНИЛС и номер телефона пользователя ${anonymizeParentDialog.email} будут удалены. Запись о профиле и его статус сохранятся в БД.`}
          onClose={() =>
            setAnonymizeParentDialog({ open: false, userId: null, email: "" })
          }
          onConfirm={() =>
            documentService.adminAnonymizeParentProfile(anonymizeParentDialog.userId).then(
              () => {
                toast.success("Данные родителя очищены, запись сохранена");
                load();
              }
            )
          }
        />

        <DeleteDialog
          open={deleteParentDialog.open}
          title="Удалить данные родителя"
          description={`Удалить паспорт, СНИЛС и номер телефона пользователя ${deleteParentDialog.email}? Файлы будут удалены безвозвратно.`}
          onClose={() =>
            setDeleteParentDialog({ open: false, userId: null, email: "" })
          }
          onConfirm={() =>
            documentService.adminDeleteParentProfile(deleteParentDialog.userId).then(
              () => {
                toast.success("Данные родителя удалены");
                load();
              }
            )
          }
        />
      </div>
    </main>
  );
};

export default AdminDocuments;
