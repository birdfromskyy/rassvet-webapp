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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import scheduleService from "../services/scheduleService";

const EMPTY = { name: "", default_duration_min: 50, minimum_teacher_break_minutes: 10, is_active: true };

const AdminSubjects = () => {
  useBrandFont()
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setSubjects(await scheduleService.getSubjects());
    } catch {
      toast.error("Ошибка загрузки предметов");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY);
    setDialog({ open: true, item: null });
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      default_duration_min: item.default_duration_min,
			minimum_teacher_break_minutes: item.minimum_teacher_break_minutes || 10,
      is_active: item.is_active,
    });
    setDialog({ open: true, item });
  };

  const close = () => setDialog({ open: false, item: null });

  const save = async () => {
    if (!form.name.trim()) { toast.error("Введите название предмета"); return; }
    try {
      if (dialog.item) {
        await scheduleService.updateSubject(dialog.item.id, form);
        toast.success("Предмет обновлён");
      } else {
        await scheduleService.createSubject(form);
        toast.success("Предмет создан");
      }
      close();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка сохранения");
    }
  };

  const toggleSubjectActive = async (subject) => {
    try {
      if (subject.is_active) {
        await scheduleService.deactivateSubject(subject.id);
        toast.success("Предмет деактивирован");
      } else {
        await scheduleService.updateSubject(subject.id, { is_active: true });
        toast.success("Предмет активирован");
      }
      load();
    } catch {
      toast.error("Ошибка изменения статуса");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Переместить предмет в архив? История занятий сохранится.")) return;
    try {
      await scheduleService.deleteSubject(id);
      toast.success("Предмет перемещён в архив");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка удаления");
    }
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">

        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Расписание</span>
            <h1>Предметы ({subjects.length})</h1>
            <p>
              Управление учебными предметами и дисциплинами центра,
              длительностью занятий и статусом активности.
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
              placeholder="Поиск по предметам..."
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
                    <TableCell>Длительность</TableCell>
									<TableCell>Мин. перерыв преподавателя</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjects
                    .filter((s) =>
                      s.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.id}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.default_duration_min} мин</TableCell>
										<TableCell>{s.minimum_teacher_break_minutes || 10} мин</TableCell>
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
                          <Tooltip title={s.is_active ? "Деактивировать" : "Активировать"}>
                            <IconButton
                              onClick={() => toggleSubjectActive(s)}
                              color={s.is_active ? "warning" : "success"}
                              size="small"
                            >
                              {s.is_active ? <PauseIcon /> : <PlayIcon />}
                            </IconButton>
                          </Tooltip>
                          <IconButton onClick={() => remove(s.id)} color="error" size="small" title="В архив">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  {!subjects.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">Предметы не найдены</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        <Dialog open={dialog.open} onClose={close} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">
            {dialog.item ? "Редактировать предмет" : "Новый предмет"}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
              <TextField
                label="Название"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
                required
              />
              <FormControl fullWidth>
                <InputLabel>Длительность занятия</InputLabel>
                <Select
                  value={form.default_duration_min}
                  label="Длительность занятия"
                  onChange={(e) => setForm({ ...form, default_duration_min: e.target.value })}
                >
                  <MenuItem value={30}>30 минут</MenuItem>
                  <MenuItem value={50}>50 минут</MenuItem>
                </Select>
              </FormControl>
							<FormControl fullWidth>
								<InputLabel>Минимальный перерыв преподавателя</InputLabel>
								<Select
									value={form.minimum_teacher_break_minutes}
									label="Минимальный перерыв преподавателя"
									onChange={(e) => setForm({ ...form, minimum_teacher_break_minutes: e.target.value })}
								>
									<MenuItem value={5}>5 минут</MenuItem>
									<MenuItem value={10}>10 минут</MenuItem>
								</Select>
							</FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={close}>Отмена</Button>
            <Button onClick={save} variant="contained">Сохранить</Button>
          </DialogActions>
        </Dialog>

      </div>
    </main>
  );
};

export default AdminSubjects;
