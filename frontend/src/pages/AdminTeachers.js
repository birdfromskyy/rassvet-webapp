import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
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
  OutlinedInput,
  Checkbox,
  ListItemText,
  Divider,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  School as SubjectsIcon,
  AccessTime as AvailIcon,
  MeetingRoom as RoomIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import scheduleService from "../services/scheduleService";
import { uploadFile, getUploadUrl } from "../services/cmsService";

const WEEKDAY_FULL = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
};

const EMPTY_TEACHER = {
  full_name: "",
  is_active: true,
  category: "",
  photo_url: "",
  qualifications: "",
  education: "",
  experience: "",
  sort_order_cms: 0,
  show_on_site: false,
};

const EMPTY_AVAIL = { weekday: 1, start_time: "09:00", end_time: "18:00" };

const AdminTeachers = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [form, setForm] = useState(EMPTY_TEACHER);

  // Subjects dialog
  const [subjectsDialog, setSubjectsDialog] = useState({
    open: false,
    teacher: null,
  });
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

  // Availability dialog
  const [availDialog, setAvailDialog] = useState({
    open: false,
    teacher: null,
  });
  const [availList, setAvailList] = useState([]);
  const [availForm, setAvailForm] = useState(EMPTY_AVAIL);
  const [availEditId, setAvailEditId] = useState(null);

  // Rooms dialog
  const [roomsDialog, setRoomsDialog] = useState({
    open: false,
    teacher: null,
  });
  const [allRooms, setAllRooms] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [roomsIsStrict, setRoomsIsStrict] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [teachersData, subjectsData, roomsData] = await Promise.all([
        scheduleService.getTeachers(),
        scheduleService.getSubjects(),
        scheduleService.getRooms(),
      ]);
      setTeachers(teachersData);
      setAllSubjects(subjectsData);
      setAllRooms(roomsData);
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  // ── Edit handlers ──────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_TEACHER, sort_order_cms: teachers.length });
    setEditDialog({ open: true, item: null });
  };

  const parseJsonToLines = (str) => {
    try { return JSON.parse(str || "[]").join("\n"); } catch { return str || ""; }
  };

  const openEdit = (item) => {
    setForm({
      full_name: item.full_name,
      is_active: item.is_active,
      category: item.category || "",
      photo_url: item.photo_url || "",
      qualifications: parseJsonToLines(item.qualifications),
      education: parseJsonToLines(item.education),
      experience: item.experience || "",
      sort_order_cms: item.sort_order_cms ?? 0,
      show_on_site: item.show_on_site ?? false,
    });
    setEditDialog({ open: true, item });
  };

  const closeEdit = () => setEditDialog({ open: false, item: null });

  const linesToJson = (str) =>
    JSON.stringify(str.split("\n").map((s) => s.trim()).filter(Boolean));

  const saveTeacher = async () => {
    if (!form.full_name.trim()) {
      toast.error("Введите ФИО преподавателя");
      return;
    }
    try {
      const data = {
        full_name: form.full_name.trim(),
        is_active: form.is_active,
        category: form.category || "",
        photo_url: form.photo_url || "",
        qualifications: linesToJson(form.qualifications),
        education: linesToJson(form.education),
        experience: form.experience || "",
        sort_order_cms: Number(form.sort_order_cms) || 0,
        show_on_site: form.show_on_site,
      };
      if (editDialog.item) {
        await scheduleService.updateTeacher(editDialog.item.id, data);
        toast.success("Преподаватель обновлён");
      } else {
        await scheduleService.createTeacher(data);
        toast.success("Преподаватель создан");
      }
      closeEdit();
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, photo_url: url }));
      toast.success("Фото загружено");
    } catch {
      toast.error("Ошибка загрузки фото");
    }
  };

  const toggleTeacherActive = async (teacher) => {
    try {
      if (teacher.is_active) {
        await scheduleService.deactivateTeacher(teacher.id);
        toast.success("Преподаватель деактивирован");
      } else {
        await scheduleService.updateTeacher(teacher.id, { is_active: true });
        toast.success("Преподаватель активирован");
      }
      loadAll();
    } catch {
      toast.error("Ошибка изменения статуса");
    }
  };

  const removeTeacher = async (id) => {
    if (!window.confirm("Удалить преподавателя безвозвратно?")) return;
    try {
      await scheduleService.deleteTeacher(id);
      toast.success("Преподаватель удалён");
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка удаления");
    }
  };

  // ── Subjects handlers ──────────────────────────────
  const openSubjects = async (teacher) => {
    try {
      const data = await scheduleService.getTeacherSubjects(teacher.id);
      setSelectedSubjectIds(data.map((ts) => ts.subject_id));
      setSubjectsDialog({ open: true, teacher });
    } catch {
      toast.error("Ошибка загрузки предметов");
    }
  };

  const closeSubjects = () => setSubjectsDialog({ open: false, teacher: null });

  const saveSubjects = async () => {
    try {
      await scheduleService.updateTeacherSubjects(
        subjectsDialog.teacher.id,
        selectedSubjectIds,
      );
      toast.success("Предметы преподавателя обновлены");
      closeSubjects();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  // ── Rooms handlers ────────────────────────────────
  const openRooms = async (teacher) => {
    try {
      const data = await scheduleService.getTeacherRooms(teacher.id);
      setSelectedRoomIds(data.map((tr) => tr.room_id));
      setRoomsIsStrict(data.length > 0 ? data[0].is_strict : false);
      setRoomsDialog({ open: true, teacher });
    } catch {
      toast.error("Ошибка загрузки кабинетов");
    }
  };

  const closeRooms = () => setRoomsDialog({ open: false, teacher: null });

  const saveRooms = async () => {
    try {
      await scheduleService.updateTeacherRooms(
        roomsDialog.teacher.id,
        selectedRoomIds,
        roomsIsStrict,
      );
      toast.success("Кабинеты преподавателя обновлены");
      closeRooms();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  // ── Availability handlers ──────────────────────────
  const openAvail = async (teacher) => {
    try {
      const data = await scheduleService.getTeacherAvailability(teacher.id);
      setAvailList(data);
      setAvailForm(EMPTY_AVAIL);
      setAvailEditId(null);
      setAvailDialog({ open: true, teacher });
    } catch {
      toast.error("Ошибка загрузки рабочего времени");
    }
  };

  const closeAvail = () => {
    setAvailDialog({ open: false, teacher: null });
    setAvailEditId(null);
  };

  const reloadAvail = async () => {
    const data = await scheduleService.getTeacherAvailability(
      availDialog.teacher.id,
    );
    setAvailList(data);
  };

  const saveAvail = async () => {
    try {
      if (availEditId) {
        await scheduleService.updateTeacherAvailability(
          availDialog.teacher.id,
          availEditId,
          availForm,
        );
        toast.success("Окно обновлено");
      } else {
        await scheduleService.createTeacherAvailability(
          availDialog.teacher.id,
          availForm,
        );
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
    setAvailForm({
      weekday: item.weekday,
      start_time: item.start_time,
      end_time: item.end_time,
    });
    setAvailEditId(item.id);
  };

  const deleteAvailItem = async (availId) => {
    if (!window.confirm("Удалить окно?")) return;
    try {
      await scheduleService.deleteTeacherAvailability(
        availDialog.teacher.id,
        availId,
      );
      toast.success("Окно удалено");
      await reloadAvail();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h4">Преподаватели</Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
            >
              Добавить
            </Button>
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate(-1)}
            >
              Назад
            </Button>
          </Box>
        </Box>

        <TextField
          placeholder="Поиск по ФИО..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ mb: 2, width: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

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
                  <TableCell>Категория</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>На сайте</TableCell>
                  <TableCell align="center">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teachers
                  .filter((t) =>
                    t.full_name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.id}</TableCell>
                      <TableCell>{t.full_name}</TableCell>
                      <TableCell>{t.category || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={t.is_active ? "Активен" : "Неактивен"}
                          color={t.is_active ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t.show_on_site ? "Да" : "Нет"}
                          color={t.show_on_site ? "primary" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={() => openEdit(t)}
                          size="small"
                          title="Редактировать"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => openSubjects(t)}
                          size="small"
                          color="primary"
                          title="Предметы"
                        >
                          <SubjectsIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => openAvail(t)}
                          size="small"
                          color="secondary"
                          title="Рабочее время"
                        >
                          <AvailIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => openRooms(t)}
                          size="small"
                          color="info"
                          title="Кабинеты"
                        >
                          <RoomIcon />
                        </IconButton>
                        <Tooltip
                          title={
                            t.is_active ? "Деактивировать" : "Активировать"
                          }
                        >
                          <IconButton
                            onClick={() => toggleTeacherActive(t)}
                            size="small"
                            color={t.is_active ? "warning" : "success"}
                          >
                            {t.is_active ? <PauseIcon /> : <PlayIcon />}
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          onClick={() => removeTeacher(t.id)}
                          size="small"
                          color="error"
                          title="Удалить"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                {!teachers.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        Преподаватели не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={closeEdit}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editDialog.item
            ? "Редактировать преподавателя"
            : "Новый преподаватель"}
        </DialogTitle>
        <DialogContent>
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
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
              }
              label="Активен"
            />

            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary">
                Данные для сайта
              </Typography>
            </Divider>

            <FormControl fullWidth>
              <InputLabel>Категория</InputLabel>
              <Select
                value={form.category}
                label="Категория"
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <MenuItem value="">— не указано —</MenuItem>
                <MenuItem value="Руководство">Руководство</MenuItem>
                <MenuItem value="Специалисты">Специалисты</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Фото
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                {form.photo_url && (
                  <img
                    src={getUploadUrl(form.photo_url)}
                    alt="preview"
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }}
                  />
                )}
                <Button variant="outlined" component="label" size="small">
                  Загрузить фото
                  <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
                </Button>
                {form.photo_url && (
                  <Button size="small" color="error" onClick={() => setForm((f) => ({ ...f, photo_url: "" }))}>
                    Удалить
                  </Button>
                )}
              </Box>
            </Box>

            <TextField
              label="Квалификация / должность (каждая строчка — отдельный пункт)"
              value={form.qualifications}
              onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder={"Педагог дополнительного образования\nМетодист"}
            />

            <TextField
              label="Образование (каждая строчка — отдельный пункт)"
              value={form.education}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder={"Московский педагогический университет, 2005\nКурсы повышения квалификации, 2020"}
            />

            <TextField
              label="Опыт работы"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              fullWidth
              placeholder="15 лет"
            />

            <Box display="flex" gap={2} alignItems="center">
              <TextField
                label="Порядок сортировки на сайте"
                type="number"
                value={form.sort_order_cms}
                onChange={(e) => setForm({ ...form, sort_order_cms: e.target.value })}
                sx={{ width: 220 }}
                inputProps={{ min: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.show_on_site}
                    onChange={(e) =>
                      setForm({ ...form, show_on_site: e.target.checked })
                    }
                  />
                }
                label="Показывать на сайте"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Отмена</Button>
          <Button onClick={saveTeacher} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Subjects Dialog */}
      <Dialog
        open={subjectsDialog.open}
        onClose={closeSubjects}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Предметы: {subjectsDialog.teacher?.full_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Выберите предметы, которые ведёт этот преподаватель:
            </Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Предметы</InputLabel>
              <Select
                multiple
                value={selectedSubjectIds}
                onChange={(e) => setSelectedSubjectIds(e.target.value)}
                input={<OutlinedInput label="Предметы" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip
                        key={id}
                        label={allSubjects.find((s) => s.id === id)?.name || id}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {allSubjects
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      <Checkbox checked={selectedSubjectIds.includes(s.id)} />
                      <ListItemText primary={s.name} />
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSubjects}>Отмена</Button>
          <Button onClick={saveSubjects} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Availability Dialog */}
      <Dialog
        open={availDialog.open}
        onClose={closeAvail}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Рабочее время: {availDialog.teacher?.full_name}
        </DialogTitle>
        <DialogContent>
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
                        <IconButton
                          size="small"
                          onClick={() => editAvailItem(a)}
                          title="Редактировать"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteAvailItem(a.id)}
                          title="Удалить"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Рабочее время не задано
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
                  onChange={(e) =>
                    setAvailForm({ ...availForm, weekday: e.target.value })
                  }
                  size="small"
                >
                  {Object.entries(WEEKDAY_FULL).map(([k, v]) => (
                    <MenuItem key={k} value={Number(k)}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Начало (ЧЧ:ММ)"
                value={availForm.start_time}
                onChange={(e) =>
                  setAvailForm({ ...availForm, start_time: e.target.value })
                }
                size="small"
                sx={{ width: 150 }}
                placeholder="09:00"
              />
              <TextField
                label="Конец (ЧЧ:ММ)"
                value={availForm.end_time}
                onChange={(e) =>
                  setAvailForm({ ...availForm, end_time: e.target.value })
                }
                size="small"
                sx={{ width: 150 }}
                placeholder="18:00"
              />
              <Button variant="contained" size="small" onClick={saveAvail}>
                {availEditId ? "Обновить" : "Добавить"}
              </Button>
              {availEditId && (
                <Button
                  size="small"
                  onClick={() => {
                    setAvailForm(EMPTY_AVAIL);
                    setAvailEditId(null);
                  }}
                >
                  Отмена
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAvail}>Закрыть</Button>
        </DialogActions>
      </Dialog>
      {/* Rooms Dialog */}
      <Dialog
        open={roomsDialog.open}
        onClose={closeRooms}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Кабинеты: {roomsDialog.teacher?.full_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Выберите кабинеты, в которых работает преподаватель:
            </Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Кабинеты</InputLabel>
              <Select
                multiple
                value={selectedRoomIds}
                onChange={(e) => setSelectedRoomIds(e.target.value)}
                input={<OutlinedInput label="Кабинеты" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip
                        key={id}
                        label={allRooms.find((r) => r.id === id)?.name || id}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {allRooms
                  .filter((r) => r.is_active)
                  .map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      <Checkbox checked={selectedRoomIds.includes(r.id)} />
                      <ListItemText primary={r.name} />
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={roomsIsStrict}
                  onChange={(e) => setRoomsIsStrict(e.target.checked)}
                />
              }
              label="Строгая привязка (работает только в указанных кабинетах)"
              sx={{ mt: 2 }}
            />
            {roomsIsStrict && (
              <Typography
                variant="caption"
                color="warning.main"
                display="block"
                sx={{ mt: 0.5 }}
              >
                При строгой привязке алгоритм не поставит занятие, если все
                указанные кабинеты заняты.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRooms}>Отмена</Button>
          <Button onClick={saveRooms} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminTeachers;
