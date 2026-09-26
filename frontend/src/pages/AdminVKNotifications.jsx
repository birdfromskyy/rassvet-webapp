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
  MenuItem,
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
import scheduleService from "../services/scheduleService";
import staffEventsService from "../services/staffEventsService";
import "./AdminModule.scss";

const emptyForm = {
  profile_url: "",
  is_enabled: true,
  receive_admin_notifications: true,
  receive_schedule_notifications: false,
  teacher_id: "",
  receive_medical_reminders: false,
  receive_birthday_reminders: false,
  staff_reminder_revision: 0,
};

export const buildRecipientPayload = (form) => {
  const teacherID = Number(form.teacher_id) || 0;
  return {
    profile_url: String(form.profile_url || "").trim(),
    // Send all switch values explicitly, including `false`: this is required
    // for new records because database defaults must not overwrite a choice.
    is_enabled: Boolean(form.is_enabled),
    receive_admin_notifications: Boolean(form.receive_admin_notifications),
    receive_schedule_notifications: teacherID > 0 && Boolean(form.receive_schedule_notifications),
    teacher_id: teacherID,
  };
};

export const buildStaffReminderPayload = (form) => ({
  revision: Number(form.staff_reminder_revision) || 0,
  medical: Boolean(form.receive_medical_reminders),
  birthdays: Boolean(form.receive_birthday_reminders),
});

function AdminVKNotifications() {
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [staffReminderPreferences, setStaffReminderPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingID, setTestingID] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, teacherList, staffReminderData] = await Promise.all([
        vkNotificationService.getAll(),
        scheduleService.getTeachers(),
        staffEventsService.recipients(),
      ]);
      setRecipients(data.recipients || []);
      setConfigured(Boolean(data.configured));
      setTeachers(teacherList || []);
      setStaffReminderPreferences(staffReminderData || []);
    } catch {
      toast.error("Не удалось загрузить получателей VK");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (recipient) => {
    const staffPreference = staffReminderPreferences.find((item) => item.id === recipient.id);
    setEditing(recipient);
    setForm({
      profile_url: recipient.profile_url,
      is_enabled: Boolean(recipient.is_enabled),
      receive_admin_notifications: Boolean(recipient.receive_admin_notifications),
      receive_schedule_notifications: Boolean(recipient.receive_schedule_notifications),
      teacher_id: recipient.teacher_id || "",
      receive_medical_reminders: Boolean(staffPreference?.medical),
      receive_birthday_reminders: Boolean(staffPreference?.birthdays),
      staff_reminder_revision: staffPreference?.revision || 0,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.profile_url.trim()) {
      toast.error("Укажите ссылку на страницу VK");
      return;
    }
    setSaving(true);
    try {
      const payload = buildRecipientPayload(form);
      const recipient = editing
        ? await vkNotificationService.update(editing.id, payload)
        : await vkNotificationService.create(payload);
      try {
        await staffEventsService.configure(recipient.id, buildStaffReminderPayload(form));
      } catch (error) {
        await load();
        setOpen(false);
        toast.error(error.response?.data?.error || "Получатель сохранён, но настройки напоминаний не удалось сохранить");
        return;
      }
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
        receive_admin_notifications: recipient.receive_admin_notifications,
        receive_schedule_notifications: recipient.receive_schedule_notifications,
        teacher_id: recipient.teacher_id || 0,
      });
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось изменить статус доставки");
    }
  };

  const remove = async (recipient) => {
    setSaving(true);
    try {
      await vkNotificationService.delete(recipient.id);
      toast.success("Получатель удалён");
      setDeleting(null);
      await load();
    } catch {
      toast.error("Не удалось удалить получателя");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (recipient) => {
    setTestingID(recipient.id);
    try {
      await vkNotificationService.sendTest(recipient.id);
      toast.success("Тест доставки отправлен");
    } catch (error) {
      toast.error(error.response?.data?.error || "VK не принял тестовое уведомление");
    } finally {
      setTestingID(null);
    }
  };

  const sendScheduleTest = async (recipient) => {
    setTestingID(recipient.id);
    try {
      await vkNotificationService.sendScheduleTest(recipient.id);
      toast.success("Расписание на завтра отправлено");
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось отправить расписание");
    } finally {
      setTestingID(null);
    }
  };

  const activeCount = recipients.filter((recipient) => recipient.is_enabled).length;
  const staffPreferenceFor = (recipientID) => staffReminderPreferences.find((item) => item.id === recipientID);

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
                <article className="admin-vk-recipient admin-vk-recipient--complete" key={recipient.id}>
                  <div className="admin-vk-recipient__identity">
                    <span className="admin-vk-recipient__avatar">VK</span>
                    <div>
                      <a href={recipient.profile_url} target="_blank" rel="noopener noreferrer">
                        {recipient.profile_url} <OpenIcon fontSize="inherit" />
                      </a>
                      <span>VK ID: {recipient.vk_user_id}</span>
                      {recipient.teacher && <span>Расписание: {recipient.teacher.full_name}</span>}
                    </div>
                  </div>
                  <Chip label={recipient.is_enabled ? "Доставка включена" : "Доставка отключена"} color={recipient.is_enabled ? "success" : "default"} />
                  <FormControlLabel
                    className="admin-vk-recipient__switch"
                    control={<Switch checked={recipient.is_enabled} onChange={() => toggle(recipient)} />}
                    label="Получать"
                  />
                  {(() => {
                    const preference = staffPreferenceFor(recipient.id);
                    return (
                      <div className="admin-vk-recipient__preferences">
                        <span>Медосмотры: <b>{preference?.medical ? "включены" : "выключены"}</b></span>
                        <span>Дни рождения: <b>{preference?.birthdays ? "включены" : "выключены"}</b></span>
                      </div>
                    );
                  })()}
                  <div className="admin-vk-recipient__tests">
                    <Button
                      variant="outlined"
                      startIcon={testingID === recipient.id ? <CircularProgress size={17} /> : <SendIcon />}
                      disabled={!configured || !recipient.is_enabled || testingID !== null}
                      onClick={() => sendTest(recipient)}
                    >
                      Проверить доставку
                    </Button>
                    {recipient.receive_schedule_notifications && (
                      <Button
                        variant="outlined"
                        startIcon={testingID === recipient.id ? <CircularProgress size={17} /> : <SendIcon />}
                        disabled={!configured || !recipient.is_enabled || testingID !== null}
                        onClick={() => sendScheduleTest(recipient)}
                      >
                        Расписание на завтра
                      </Button>
                    )}
                  </div>
                  <div className="admin-vk-recipient__actions">
                    <Tooltip title="Редактировать"><IconButton onClick={() => openEdit(recipient)}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Удалить"><IconButton color="error" onClick={() => setDeleting(recipient)}><DeleteIcon /></IconButton></Tooltip>
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
            <FormControlLabel
              control={<Switch checked={form.receive_admin_notifications} onChange={(event) => setForm((current) => ({ ...current, receive_admin_notifications: event.target.checked }))} />}
              label="Общие уведомления администрации"
            />
            <TextField
              select
              label="Преподаватель"
              value={form.teacher_id}
              onChange={(event) => setForm((current) => ({
                ...current,
                teacher_id: event.target.value,
                receive_schedule_notifications: event.target.value ? current.receive_schedule_notifications : false,
              }))}
              fullWidth
            >
              <MenuItem value="">Не привязывать</MenuItem>
              {teachers.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>{teacher.full_name}</MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={(
                <Switch
                  checked={form.receive_schedule_notifications}
                  disabled={!form.teacher_id}
                  onChange={(event) => setForm((current) => ({ ...current, receive_schedule_notifications: event.target.checked }))}
                />
              )}
              label="Расписание преподавателя"
            />
            <Box className="admin-vk-form__section">
              <span className="admin-vk-form__section-title">Напоминания сотрудникам</span>
              <FormControlLabel
                control={<Switch checked={form.receive_medical_reminders} onChange={(event) => setForm((current) => ({ ...current, receive_medical_reminders: event.target.checked }))} />}
                label="Медосмотры"
              />
              <FormControlLabel
                control={<Switch checked={form.receive_birthday_reminders} onChange={(event) => setForm((current) => ({ ...current, receive_birthday_reminders: event.target.checked }))} />}
                label="Дни рождения сотрудников"
              />
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)} disabled={saving}>Отмена</Button>
            <Button variant="contained" onClick={save} disabled={saving || !form.profile_url.trim()}>{saving ? "Сохранение..." : "Сохранить"}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={Boolean(deleting)} onClose={() => !saving && setDeleting(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Удалить получателя VK?</DialogTitle>
          <DialogContent><p>{deleting?.profile_url}</p></DialogContent>
          <DialogActions>
            <Button disabled={saving} onClick={() => setDeleting(null)}>Отмена</Button>
            <Button disabled={saving} color="error" variant="contained" onClick={() => remove(deleting)}>Удалить</Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}

export default AdminVKNotifications;
