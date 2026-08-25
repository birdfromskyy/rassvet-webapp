import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenIcon,
  Send as SendIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import vkNotificationService from "../services/vkNotificationService";
import "./AdminModule.scss";

const emptyForm = { profile_url: "", is_enabled: true };

function AdminVKNotifications() {
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingID, setTestingID] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vkNotificationService.getAll();
      setRecipients(data.recipients || []);
      setConfigured(Boolean(data.configured));
    } catch {
      toast.error("Не удалось загрузить получателей VK");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (recipient) => {
    setEditing(recipient);
    setForm({ profile_url: recipient.profile_url, is_enabled: recipient.is_enabled });
    setOpen(true);
  };

  const save = async () => {
    if (!form.profile_url.trim()) {
      toast.error("Укажите ссылку на страницу VK");
      return;
    }
    setSaving(true);
    try {
      if (editing) await vkNotificationService.update(editing.id, form);
      else await vkNotificationService.create(form);
      toast.success(editing ? "Получатель обновлён" : "Получатель добавлен");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось сохранить получателя");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (recipient) => {
    try {
      await vkNotificationService.update(recipient.id, {
        profile_url: recipient.profile_url,
        is_enabled: !recipient.is_enabled,
      });
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось изменить статус доставки");
    }
  };

  const remove = async (recipient) => {
    if (!window.confirm(`Удалить получателя VK ${recipient.profile_url}?`)) return;
    try {
      await vkNotificationService.delete(recipient.id);
      toast.success("Получатель удалён");
      await load();
    } catch {
      toast.error("Не удалось удалить получателя");
    }
  };

  const sendTest = async (recipient) => {
    setTestingID(recipient.id);
    try {
      await vkNotificationService.sendTest(recipient.id);
      toast.success("Тестовое уведомление отправлено");
    } catch (error) {
      toast.error(error.response?.data?.error || "VK не принял тестовое уведомление");
    } finally {
      setTestingID(null);
    }
  };

  const activeCount = recipients.filter((recipient) => recipient.is_enabled).length;

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Уведомления</span>
            <h1>Получатели уведомлений VK</h1>
            <p>Копии общих уведомлений для администрации отправляются в личные сообщения от имени сообщества.</p>
          </div>
          <div className="admin-module__actions">
            <Button startIcon={<BackIcon />} onClick={() => navigate("/admin/cms")} className="admin-module__button admin-module__button--ghost">Назад</Button>
            <Button startIcon={<AddIcon />} onClick={openCreate} className="admin-module__button admin-module__button--primary">Добавить страницу</Button>
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat"><span>Всего получателей</span><strong>{recipients.length}</strong></div>
          <div className="admin-users-stat"><span>Доставка включена</span><strong>{activeCount}</strong></div>
          <div className="admin-users-stat"><span>Доставка отключена</span><strong>{recipients.length - activeCount}</strong></div>
        </div>

        <section className="admin-module__panel">
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : recipients.length === 0 ? (
            <div className="admin-vk-empty">
              <SendIcon />
              <h2>Получателей пока нет</h2>
              <p>Добавьте ссылку на страницу человека, который уже написал сообщениям сообщества.</p>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Добавить страницу</Button>
            </div>
          ) : (
            <div className="admin-vk-list">
              {recipients.map((recipient) => (
                <article className="admin-vk-recipient" key={recipient.id}>
                  <div className="admin-vk-recipient__identity">
                    <span className="admin-vk-recipient__avatar">VK</span>
                    <div>
                      <a href={recipient.profile_url} target="_blank" rel="noopener noreferrer">
                        {recipient.profile_url} <OpenIcon fontSize="inherit" />
                      </a>
                      <span>VK ID: {recipient.vk_user_id}</span>
                    </div>
                  </div>
                  <Chip label={recipient.is_enabled ? "Доставка включена" : "Доставка отключена"} color={recipient.is_enabled ? "success" : "default"} />
                  <FormControlLabel
                    className="admin-vk-recipient__switch"
                    control={<Switch checked={recipient.is_enabled} onChange={() => toggle(recipient)} />}
                    label="Получать"
                  />
                  <Button
                    variant="outlined"
                    startIcon={testingID === recipient.id ? <CircularProgress size={17} /> : <SendIcon />}
                    disabled={!configured || !recipient.is_enabled || testingID !== null}
                    onClick={() => sendTest(recipient)}
                  >
                    Тестовое уведомление
                  </Button>
                  <div className="admin-vk-recipient__actions">
                    <Tooltip title="Редактировать"><IconButton onClick={() => openEdit(recipient)}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Удалить"><IconButton color="error" onClick={() => remove(recipient)}><DeleteIcon /></IconButton></Tooltip>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">{editing ? "Редактировать получателя" : "Добавить получателя VK"}</DialogTitle>
          <DialogContent dividers className="admin-module-dialog__content">
            <TextField
              label="Ссылка на страницу VK"
              value={form.profile_url}
              onChange={(event) => setForm((current) => ({ ...current, profile_url: event.target.value }))}
              placeholder="https://vk.com/id123456"
              helperText="Пользователь должен предварительно написать сообщениям сообщества."
              fullWidth
              required
              autoFocus
            />
            <FormControlLabel
              control={<Switch checked={form.is_enabled} onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))} />}
              label="Включить доставку уведомлений"
            />
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)} disabled={saving}>Отмена</Button>
            <Button variant="contained" onClick={save} disabled={saving || !form.profile_url.trim()}>{saving ? "Сохранение..." : "Сохранить"}</Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}

export default AdminVKNotifications;
