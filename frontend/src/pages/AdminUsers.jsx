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
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Badge,
  Autocomplete,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  ChildCare as ChildIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  DeleteForever as DeleteDataIcon,
  Visibility,
  VisibilityOff,
  Casino as GenerateIcon,
  Search as SearchIcon,
  School as TeacherLinkIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import scheduleService from "../services/scheduleService";
import documentService from "../services/documentService";
import { isAdmin, isSuperAdmin as isSuperAdminRole } from "../utils/roles";
import { useAuth } from "../contexts/AuthContext";
import "./AdminModule.scss";

const MODULE_TITLE = "Пользователи";

const EMPTY_FORM = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  role: "user",
};


const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
const generatePassword = () =>
  Array.from(
    { length: 12 },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)]
  ).join("");

const getRoleLabel = (role) => {
  if (role === "superadmin") return "Суперадмин";
  if (role === "admin") return "Администратор";
  if (role === "teacher") return "Сотрудник";
  return "Пользователь";
};

const getRoleColor = (role) => {
  if (role === "superadmin") return "secondary";
  if (role === "admin") return "error";
  if (role === "teacher") return "primary";
  return "default";
};

const UserFormFields = ({ form, setForm, isEdit, targetIsSuperAdmin }) => {
  const [showPwd, setShowPwd] = React.useState(false);
  const { user: currentUser } = useAuth() || {};
  const isSuperAdmin = () => isSuperAdminRole(currentUser?.role);

  const handleGenerate = () => {
    const pwd = generatePassword();
    setForm((f) => ({ ...f, password: pwd }));
    setShowPwd(true);
  };

  return (
    <Box className="admin-user-form">
      <TextField
        label="Email *"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        fullWidth
        type="email"
      />

      <Box className="admin-user-form__password">
        <TextField
          label={isEdit ? "Новый пароль" : "Пароль *"}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          fullWidth
          type={showPwd ? "text" : "password"}
          helperText={isEdit ? "Оставьте пустым, чтобы не менять пароль" : undefined}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                  {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Tooltip title="Сгенерировать случайный пароль">
          <Button
            variant="outlined"
            startIcon={<GenerateIcon />}
            onClick={handleGenerate}
            className="admin-user-form__generate"
          >
            Сгенерировать
          </Button>
        </Tooltip>
      </Box>

      <TextField
        label="Фамилия *"
        value={form.last_name}
        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
        fullWidth
      />

      <TextField
        label="Имя *"
        value={form.first_name}
        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
        fullWidth
      />

      <TextField
        label="Отчество"
        value={form.middle_name}
        onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))}
        fullWidth
      />

      <FormControl fullWidth disabled={targetIsSuperAdmin}>
        <InputLabel>Роль</InputLabel>
        <Select
          value={form.role}
          label="Роль"
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          <MenuItem value="user">Пользователь</MenuItem>
          <MenuItem value="teacher">Сотрудник</MenuItem>
          {isSuperAdmin() && <MenuItem value="admin">Администратор</MenuItem>}
          {targetIsSuperAdmin && <MenuItem value="superadmin">Суперадминистратор</MenuItem>}
        </Select>

        {targetIsSuperAdmin && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            Роль суперадмина нельзя изменить через интерфейс.
          </Typography>
        )}
      </FormControl>
    </Box>
  );
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth() || {};
  const isSuperAdmin = () => isSuperAdminRole(currentUser?.role);

  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [childrenCounts, setChildrenCounts] = useState({});
  const [teacherByUserId, setTeacherByUserId] = useState({});
  const [search, setSearch] = useState("");

  const [childDialog, setChildDialog] = useState({ open: false, user: null });
  const [children, setChildren] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [teacherDialog, setTeacherDialog] = useState({ open: false, user: null });
  const [linkedTeacher, setLinkedTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [teacherLinkLoading, setTeacherLinkLoading] = useState(false);

  const [deleteDataDialog, setDeleteDataDialog] = useState({ open: false, user: null });
  const [deleteDataLoading, setDeleteDataLoading] = useState(false);
  const [deleteUserDialog, setDeleteUserDialog] = useState({ open: false, user: null });
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createLoading, setCreateLoading] = useState(false);

  const [editDialog, setEditDialog] = useState({ open: false, user: null });
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [usersResult, studentsData, teachersData] = await Promise.all([
        scheduleService.getUsersWithCounts(),
        scheduleService.getStudents(),
        scheduleService.getTeachers(),
      ]);
      setTeachers(teachersData);
      setTeacherByUserId(Object.fromEntries(
        teachersData.flatMap((teacher) =>
          (teacher.user_links || []).map((link) => [link.user_id, teacher])
        )
      ));

      setUsers(usersResult.users);
      setStudents(studentsData);
      setChildrenCounts(usersResult.childrenCounts);
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePersonalData = async () => {
    const u = deleteDataDialog.user;
    if (!u) return;

    setDeleteDataLoading(true);

    try {
      await documentService.adminDeletePersonalData(u.id);
      toast.success(`Персональные данные пользователя ${u.email} удалены`);
      setDeleteDataDialog({ open: false, user: null });
    } catch {
      toast.error("Ошибка удаления данных");
    } finally {
      setDeleteDataLoading(false);
    }
  };

  const openChildDialog = async (user) => {
    try {
      const data = await scheduleService.getUserChildren(user.id);
      setChildren(data);
      setSelectedStudent(null);
      setChildDialog({ open: true, user });
    } catch {
      toast.error("Ошибка загрузки детей");
    }
  };

  const closeChildDialog = () => {
    setChildDialog({ open: false, user: null });
    setChildren([]);
    setSelectedStudent(null);
  };

  const addChild = async () => {
    if (!selectedStudent) return;

    try {
      await scheduleService.addUserChild(childDialog.user.id, selectedStudent.id);
      toast.success("Ученик привязан");

      const data = await scheduleService.getUserChildren(childDialog.user.id);
      setChildren(data);
      setChildrenCounts((prev) => ({ ...prev, [childDialog.user.id]: data.length }));
      setSelectedStudent(null);
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка привязки");
    }
  };

  const removeChild = async (studentId) => {
    if (!window.confirm("Отвязать ученика от пользователя?")) return;

    try {
      await scheduleService.removeUserChild(childDialog.user.id, studentId);
      toast.success("Ученик отвязан");

      const data = await scheduleService.getUserChildren(childDialog.user.id);
      setChildren(data);
      setChildrenCounts((prev) => ({ ...prev, [childDialog.user.id]: data.length }));
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.last_name) {
      toast.error("Заполните обязательные поля");
      return;
    }

    setCreateLoading(true);

    try {
      await scheduleService.createUser(createForm);
      toast.success("Пользователь создан");
      setCreateDialog(false);
      setCreateForm(EMPTY_FORM);
      setLoading(true);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка создания пользователя");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditDialog = (user) => {
    setEditForm({
      email: user.email || "",
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      middle_name: user.middle_name || "",
      role: user.role || "user",
    });

    setEditDialog({ open: true, user });
  };

  const handleDeleteUser = async () => {
    const u = deleteUserDialog.user;
    if (!u) return;

    setDeleteUserLoading(true);

    try {
      await scheduleService.deleteUser(u.id);
      toast.success("Пользователь удалён");
      setDeleteUserDialog({ open: false, user: null });
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка удаления");
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm.email || !editForm.first_name || !editForm.last_name) {
      toast.error("Заполните обязательные поля");
      return;
    }

    setEditLoading(true);

    try {
      await scheduleService.updateUser(editDialog.user.id, editForm);
      toast.success("Данные пользователя обновлены");
      setEditDialog({ open: false, user: null });
      setLoading(true);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка обновления пользователя");
    } finally {
      setEditLoading(false);
    }
  };

  const openTeacherDialog = async (user) => {
    try {
      const data = await scheduleService.getLinkedTeacher(user.id);
      setLinkedTeacher(data.teacher || null);
      setSelectedTeacher(null);
      setTeacherDialog({ open: true, user });
    } catch {
      toast.error("Ошибка загрузки данных преподавателя");
    }
  };

  const closeTeacherDialog = () => {
    setTeacherDialog({ open: false, user: null });
    setLinkedTeacher(null);
    setSelectedTeacher(null);
  };

  const handleLinkTeacher = async () => {
    if (!selectedTeacher) return;
    setTeacherLinkLoading(true);
    try {
      const result = await scheduleService.linkTeacherToUser(teacherDialog.user.id, selectedTeacher.id);
      toast.success("Преподаватель привязан");
      setLinkedTeacher(result.teacher || selectedTeacher);
      setSelectedTeacher(null);
      setTeacherByUserId((prev) => ({
        ...prev,
        [teacherDialog.user.id]: result.teacher || selectedTeacher,
      }));
    } catch (e) {
      toast.error(e.response?.data?.error || "Ошибка привязки");
    } finally {
      setTeacherLinkLoading(false);
    }
  };

  const handleUnlinkTeacher = async () => {
    if (!window.confirm("Отвязать преподавателя от аккаунта?")) return;
    setTeacherLinkLoading(true);
    try {
      await scheduleService.unlinkTeacherFromUser(teacherDialog.user.id);
      toast.success("Преподаватель отвязан");
      setLinkedTeacher(null);
      setTeacherByUserId((prev) => {
        const next = { ...prev };
        delete next[teacherDialog.user.id];
        return next;
      });
    } catch {
      toast.error("Ошибка отвязки");
    } finally {
      setTeacherLinkLoading(false);
    }
  };

  const linkedStudentIds = children.map((c) => c.student_id);
  const availableStudents = students
    .filter((s) => !linkedStudentIds.includes(s.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = normalizedSearch
    ? users.filter((u) =>
        [u.email, u.first_name, u.last_name, u.middle_name, u.role, String(u.id)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : users;

  const usersStats = [
    { title: "Всего", value: users.length },
    { title: "Родители", value: users.filter((u) => u.role === "user").length },
    { title: "Сотрудники", value: users.filter((u) => u.role === "teacher").length },
    { title: "Админы", value: users.filter((u) => u.role === "admin" || u.role === "superadmin").length },
  ];

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Администрирование</span>
            <h1>{MODULE_TITLE}</h1>
            <p>
              Управление пользователями, ролями, привязкой детей, доступом к системе и удалением персональных данных.
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
              startIcon={<PersonAddIcon />}
              onClick={() => {
                setCreateForm(EMPTY_FORM);
                setCreateDialog(true);
              }}
              className="admin-module__button admin-module__button--primary"
            >
              Создать пользователя
            </Button>
          </div>
        </section>

        <section className="admin-users-stats">
          {usersStats.map((item) => (
            <article className="admin-users-stat" key={item.title}>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="admin-module__panel">
          <p className="admin-module__hint">
            Привяжите учеников к учётным записям родителей — они смогут видеть расписание своего ребёнка после публикации.
          </p>

          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">Найдено: {filteredUsers.length}</span>
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
                    <TableCell>Email</TableCell>
                    <TableCell>ФИО</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell>Преподаватель</TableCell>
                    <TableCell align="center">Дети</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{[u.last_name, u.first_name, u.middle_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell>
                        <Chip label={getRoleLabel(u.role)} color={getRoleColor(u.role)} size="small" />
                      </TableCell>
                      <TableCell>
                        {teacherByUserId[u.id]?.full_name || "—"}
                      </TableCell>
                      <TableCell align="center">
                        {(childrenCounts[u.id] || 0) > 0 ? (
                          <Chip label={childrenCounts[u.id]} color="success" size="small" icon={<ChildIcon />} />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {(isAdmin(u.role) || u.role === "superadmin") && !isSuperAdmin() ? (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        ) : (
                          <>
                            {u.role !== "superadmin" && (
                              <Tooltip title="Редактировать пользователя">
                                <IconButton size="small" onClick={() => openEditDialog(u)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Управление детьми">
                              <IconButton size="small" color="primary" onClick={() => openChildDialog(u)}>
                                <Badge badgeContent={childrenCounts[u.id] || 0} color="success" invisible={(childrenCounts[u.id] || 0) === 0}>
                                  <ChildIcon />
                                </Badge>
                              </IconButton>
                            </Tooltip>
                            {u.role !== "user" && (
                              <Tooltip title={teacherByUserId[u.id] ? "Изменить привязку преподавателя" : "Привязать преподавателя"}>
                                <IconButton size="small" color="secondary" onClick={() => openTeacherDialog(u)}>
                                  <Badge variant="dot" color="success" invisible={!teacherByUserId[u.id]}>
                                    <TeacherLinkIcon fontSize="small" />
                                  </Badge>
                                </IconButton>
                              </Tooltip>
                            )}
                            {u.role !== "superadmin" && (
                              <>
                                <Tooltip title="Удалить персональные данные">
                                  <IconButton size="small" color="error" onClick={() => setDeleteDataDialog({ open: true, user: u })}>
                                    <DeleteDataIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Удалить пользователя полностью">
                                  <IconButton size="small" color="error" onClick={() => setDeleteUserDialog({ open: true, user: u })}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredUsers.length && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">Пользователи не найдены</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        <Dialog open={childDialog.open} onClose={closeChildDialog} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">
            Дети пользователя: {childDialog.user?.first_name} {childDialog.user?.last_name}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            {children.length > 0 ? (
              <List dense>
                {children.map((link) => (
                  <ListItem key={link.id} divider>
                    <ListItemText
                      primary={link.student?.full_name || `Ученик #${link.student_id}`}
                      secondary={link.student?.is_active ? "Активен" : "Неактивен"}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" color="error" size="small" onClick={() => removeChild(link.student_id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Дети не привязаны</Typography>
            )}

            <Divider />
            <Typography variant="subtitle2">Привязать ученика</Typography>

            <Box className="admin-user-children-add">
              <Autocomplete
                fullWidth
                options={availableStudents}
                getOptionLabel={(s) => s.full_name + (s.is_active ? "" : " (неактивен)")}
                value={selectedStudent}
                onChange={(_, val) => setSelectedStudent(val)}
                noOptionsText={availableStudents.length === 0 ? "Все ученики уже привязаны" : "Ничего не найдено"}
                renderInput={(params) => <TextField {...params} label="Поиск ученика" />}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={addChild} disabled={!selectedStudent}>
                Добавить
              </Button>
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={closeChildDialog}>Закрыть</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={teacherDialog.open} onClose={closeTeacherDialog} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">
            Привязка преподавателя: {teacherDialog.user?.first_name} {teacherDialog.user?.last_name}
          </DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            {linkedTeacher ? (
              <>
                <Typography variant="subtitle2" gutterBottom>Текущий преподаватель:</Typography>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography>{linkedTeacher.full_name}</Typography>
                  <IconButton size="small" color="error" onClick={handleUnlinkTeacher} disabled={teacherLinkLoading}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Divider />
              </>
            ) : (
              <Typography color="text.secondary" mb={2}>Преподаватель не привязан</Typography>
            )}
            <Typography variant="subtitle2" gutterBottom>
              {linkedTeacher ? "Сменить преподавателя:" : "Привязать преподавателя:"}
            </Typography>
            <Box className="admin-user-children-add">
              <Autocomplete
                fullWidth
                options={teachers.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))}
                getOptionLabel={(t) => t.full_name + (t.is_active ? "" : " (неактивен)")}
                value={selectedTeacher}
                onChange={(_, val) => setSelectedTeacher(val)}
                noOptionsText="Преподаватели не найдены"
                renderInput={(params) => <TextField {...params} label="Поиск преподавателя" />}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleLinkTeacher} disabled={!selectedTeacher || teacherLinkLoading}>
                Привязать
              </Button>
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={closeTeacherDialog}>Закрыть</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">Создать пользователя</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <UserFormFields form={createForm} setForm={setCreateForm} isEdit={false} />
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setCreateDialog(false)}>Отмена</Button>
            <Button variant="contained" onClick={handleCreate} disabled={createLoading}>
              {createLoading ? "Создание..." : "Создать"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, user: null })} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">Редактировать пользователя #{editDialog.user?.id}</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <UserFormFields
              form={editForm}
              setForm={setEditForm}
              isEdit={true}
              targetIsSuperAdmin={editDialog.user?.role === "superadmin"}
            />
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setEditDialog({ open: false, user: null })}>Отмена</Button>
            <Button variant="contained" onClick={handleEdit} disabled={editLoading}>
              {editLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDataDialog.open} onClose={() => setDeleteDataDialog({ open: false, user: null })} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog admin-module-dialog--danger" }}>
          <DialogTitle className="admin-module-dialog__title">Удалить персональные данные</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Typography>Вы собираетесь безвозвратно удалить персональные данные пользователя:</Typography>
            <Typography fontWeight={900}>{deleteDataDialog.user?.email}</Typography>
            <Typography variant="body2" color="text.secondary">Будут удалены:</Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">Все заявки с документами детей и прикреплённые файлы</Typography>
              <Typography component="li" variant="body2">Номер телефона родителя</Typography>
              <Typography component="li" variant="body2">Файлы паспорта и СНИЛС родителя</Typography>
            </Box>
            <Typography variant="body2" color="error.main" fontWeight={700}>Это действие нельзя отменить.</Typography>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setDeleteDataDialog({ open: false, user: null })}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeletePersonalData} disabled={deleteDataLoading}>
              {deleteDataLoading ? "Удаление..." : "Удалить данные"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteUserDialog.open} onClose={() => setDeleteUserDialog({ open: false, user: null })} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog admin-module-dialog--danger" }}>
          <DialogTitle className="admin-module-dialog__title">Удалить пользователя</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Typography>Вы собираетесь безвозвратно удалить:</Typography>
            <Typography fontWeight={900}>
              {deleteUserDialog.user?.email} — {[deleteUserDialog.user?.last_name, deleteUserDialog.user?.first_name].filter(Boolean).join(" ") || "имя не указано"}
            </Typography>
            <Typography variant="body2" color="text.secondary">Вместе с пользователем будут удалены:</Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              {[
                "Анкетирование и файл анкеты",
                "Документы родителя (паспорт, СНИЛС)",
                "Документы детей (ИППСУ, свидетельство о рождении, СНИЛС)",
                "Все уведомления",
                "Отзывы пользователя",
                "Заявки на консультацию",
                "Привязки к ученикам",
              ].map((item) => (
                <Typography key={item} component="li" variant="body2">{item}</Typography>
              ))}
            </Box>
            <Typography variant="body2" color="error.main" fontWeight={700}>Это действие нельзя отменить.</Typography>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setDeleteUserDialog({ open: false, user: null })}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteUser} disabled={deleteUserLoading}>
              {deleteUserLoading ? "Удаление..." : "Удалить пользователя"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
};

export default AdminUsers;
