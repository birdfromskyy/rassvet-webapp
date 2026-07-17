import "./AdminModule.scss";
import useBrandFont from '../hooks/useBrandFont'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  AccessTime as AvailIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import scheduleService from "../services/scheduleService";

const WEEKDAY_FULL = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
};

const EMPTY_STUDENT = { full_name: "", is_active: true, allow_schedule_windows: false };
const EMPTY_AVAIL = { weekday: 1, start_time: "09:00", end_time: "18:00" };

const AdminStudents = () => {
  useBrandFont()
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [form, setForm] = useState(EMPTY_STUDENT);

  const [availDialog, setAvailDialog] = useState({ open: false, student: null });
  const [availList, setAvailList] = useState([]);
  const [availForm, setAvailForm] = useState(EMPTY_AVAIL);
  const [availEditId, setAvailEditId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setStudents(await scheduleService.getStudents());
    } catch {
      toast.error("Ошибка загрузки учеников");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_STUDENT);
    setEditDialog({ open: true, item: null });
  };

  const openEdit = (item) => {
    setForm({ full_name: item.full_name, is_active: item.is_active, allow_schedule_windows: Boolean(item.allow_schedule_windows) });
    setEditDialog({ open: true, item });
  };

  const closeEdit = () => setEditDialog({ open: false, item: null });

  const saveStudent = async () => {
    if (!form.full_name.trim()) { toast.error("Введите ФИО ученика"); return; }
    try {
      const data = { full_name: form.full_name.trim(), is_active: form.is_active, allow_schedule_windows: form.allow_schedule_windows };
      if (editDialog.item) {
        await scheduleService.updateStudent(editDialog.item.id, data);
        toast.success("Ученик обновлён");
      } else {
        await scheduleService.createStudent(data);
        toast.success("Ученик создан");
      }
      closeEdit();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  const toggleStudentActive = async (student) => {
    try {
      if (student.is_active) {
        await scheduleService.deactivateStudent(student.id);
        toast.success("Ученик деактивирован");
      } else {
        await scheduleService.updateStudent(student.id, { is_active: true });
        toast.success("Ученик активирован");
      }
      load();
    } catch {
      toast.error("Ошибка изменения статуса");
    }
  };

  const removeStudent = async (id) => {
    if (!window.confirm("Переместить ученика в архив? История занятий сохранится.")) return;
    try {
      await scheduleService.deleteStudent(id);
      toast.success("Ученик перемещён в архив");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка удаления");
    }
  };

  const openAvail = async (student) => {
    try {
      const data = await scheduleService.getStudentAvailability(student.id);
      setAvailList(data);
      setAvailForm(EMPTY_AVAIL);
      setAvailEditId(null);
      setAvailDialog({ open: true, student });
    } catch {
      toast.error("Ошибка загрузки доступности");
    }
  };

  const closeAvail = () => {
    setAvailDialog({ open: false, student: null });
    setAvailEditId(null);
  };

  const reloadAvail = async () => {
    const data = await scheduleService.getStudentAvailability(availDialog.student.id);
    setAvailList(data);
  };

  const saveAvail = async () => {
    try {
      if (availEditId) {
        await scheduleService.updateStudentAvailability(availDialog.student.id, availEditId, availForm);
        toast.success("Окно обновлено");
      } else {
        await scheduleService.createStudentAvailability(availDialog.student.id, availForm);
        toast.success("Окно добавлено");
      }
      await reloadAvail();
      setAvailForm(EMPTY_AVAIL);
      setAvailEditId(null);
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  const editAvailItem = (item) => {
    setAvailForm({ weekday: item.weekday, start_time: item.start_time, end_time: item.end_time });
    setAvailEditId(item.id);
  };

  const deleteAvailItem = async (availId) => {
    if (!window.confirm("Удалить окно?")) return;
    try {
      await scheduleService.deleteStudentAvailability(availDialog.student.id, availId);
      toast.success("Окно удалено");
      await reloadAvail();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">

        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Расписание</span>
            <h1>Ученики ({students.length})</h1>
            <p>
              Управление учениками, их доступностью по дням и временным
              окнам для корректного формирования расписания.
            </p>
          </div>
          <div className="admin-module__actions">
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate("/admin/schedule")}
              className="admin-module__button admin-module__button--ghost"
            >
              Назад
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
              placeholder="Поиск по ученикам..."
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
                    <TableCell>ФИО</TableCell>
									<TableCell>Окна</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students
                    .filter((s) =>
                      s.full_name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
                    .map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.id}</TableCell>
                        <TableCell>{s.full_name}</TableCell>
										<TableCell>{s.allow_schedule_windows ? 'Разрешены' : 'Не разрешены'}</TableCell>
                        <TableCell>
                          <Chip
                            label={s.is_active ? "Активен" : "Неактивен"}
                            color={s.is_active ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => openEdit(s)} size="small" title="Редактировать">
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => openAvail(s)} size="small" color="secondary" title="Доступность">
                            <AvailIcon />
                          </IconButton>
                          <Tooltip title={s.is_active ? "Деактивировать" : "Активировать"}>
                            <IconButton
                              onClick={() => toggleStudentActive(s)}
                              size="small"
                              color={s.is_active ? "warning" : "success"}
                            >
                              {s.is_active ? <PauseIcon /> : <PlayIcon />}
                            </IconButton>
                          </Tooltip>
                          <IconButton onClick={() => removeStudent(s.id)} size="small" color="error" title="В архив">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  {!students.length && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">Ученики не найдены</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        {/* Edit Dialog */}
        <Dialog open={editDialog.open} onClose={closeEdit} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">
            {editDialog.item ? "Редактировать ученика" : "Новый ученик"}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
              <TextField
                label="ФИО"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                fullWidth
                required
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                }
                label="Активен"
              />
							<FormControlLabel
								control={
									<Switch
										checked={Boolean(form.allow_schedule_windows)}
										onChange={(e) => setForm({ ...form, allow_schedule_windows: e.target.checked })}
									/>
								}
								label="Можно ставить длинные окна между занятиями"
							/>
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={closeEdit}>Отмена</Button>
            <Button onClick={saveStudent} variant="contained">Сохранить</Button>
          </DialogActions>
        </Dialog>

        {/* Availability Dialog */}
        <Dialog open={availDialog.open} onClose={closeAvail} maxWidth="md" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">
            Доступность: {availDialog.student?.full_name}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Box sx={{ mt: 1 }}>
              {availList.length > 0 ? (
                <Table size="small" sx={{ mb: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>День недели</TableCell>
                      <TableCell>Начало</TableCell>
                      <TableCell>Конец</TableCell>
                      <TableCell align="center">Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availList.map((a) => (
                      <TableRow key={a.id} selected={availEditId === a.id}>
                        <TableCell>{WEEKDAY_FULL[a.weekday]}</TableCell>
                        <TableCell>{a.start_time}</TableCell>
                        <TableCell>{a.end_time}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => editAvailItem(a)} title="Редактировать">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteAvailItem(a.id)} title="Удалить">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Доступность не задана
                </Typography>
              )}

              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                {availEditId ? "Редактировать окно" : "Добавить окно"}
              </Typography>

              <Box display="flex" gap={2} alignItems="flex-end" flexWrap="wrap">
                <FormControl sx={{ minWidth: 160 }}>
                  <InputLabel>День недели</InputLabel>
                  <Select
                    value={availForm.weekday}
                    label="День недели"
                    onChange={(e) => setAvailForm({ ...availForm, weekday: e.target.value })}
                    size="small"
                  >
                    {Object.entries(WEEKDAY_FULL).map(([k, v]) => (
                      <MenuItem key={k} value={Number(k)}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Начало (ЧЧ:ММ)"
                  value={availForm.start_time}
                  onChange={(e) => setAvailForm({ ...availForm, start_time: e.target.value })}
                  size="small"
                  sx={{ width: 150 }}
                  placeholder="09:00"
                />
                <TextField
                  label="Конец (ЧЧ:ММ)"
                  value={availForm.end_time}
                  onChange={(e) => setAvailForm({ ...availForm, end_time: e.target.value })}
                  size="small"
                  sx={{ width: 150 }}
                  placeholder="18:00"
                />
                <Button variant="contained" size="small" onClick={saveAvail}>
                  {availEditId ? "Обновить" : "Добавить"}
                </Button>
                {availEditId && (
                  <Button size="small" onClick={() => { setAvailForm(EMPTY_AVAIL); setAvailEditId(null); }}>
                    Отмена
                  </Button>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={closeAvail}>Закрыть</Button>
          </DialogActions>
        </Dialog>

      </div>
    </main>
  );
};

export default AdminStudents;
