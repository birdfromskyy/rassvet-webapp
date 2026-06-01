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
  Rating,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ArrowBack as BackIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Add as AddIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import reviewService from "../services/reviewService";

const STATUS_LABELS = { pending: "На модерации", approved: "Одобрен", rejected: "Отклонён" };
const STATUS_COLORS = { pending: "warning", approved: "success", rejected: "error" };
const PLATFORMS = ["2ГИС", "Яндекс", "Google", "ВКонтакте", "Лично"];

const EMPTY_EXTERNAL = { author_name: "", source_platform: "", rating: 5, content: "" };

const AdminReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [viewDialog, setViewDialog] = useState({ open: false, review: null });
  const [editDialog, setEditDialog] = useState({ open: false, review: null });
  const [editData, setEditData] = useState({ content: "", rating: 5 });

  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_EXTERNAL);
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => { fetchReviews(); }, [statusFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await reviewService.getAllReviews(statusFilter);
      setReviews(data);
    } catch {
      toast.error("Ошибка загрузки отзывов");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (review) => {
    setEditData({ content: review.content, rating: review.rating });
    setEditDialog({ open: true, review });
  };

  const handleSaveEdit = async () => {
    try {
      await reviewService.updateReview(editDialog.review.id, editData);
      toast.success("Отзыв обновлён");
      setEditDialog({ open: false, review: null });
      fetchReviews();
    } catch {
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить этот отзыв?")) return;
    try {
      await reviewService.deleteReview(id);
      toast.success("Отзыв удалён");
      fetchReviews();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const handleApprove = async (id) => {
    try {
      await reviewService.approveReview(id);
      toast.success("Отзыв одобрен");
      fetchReviews();
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleReject = async (id) => {
    try {
      await reviewService.rejectReview(id);
      toast.success("Отзыв отклонён");
      fetchReviews();
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleAddExternal = async () => {
    if (!addForm.author_name.trim()) { toast.error("Укажите имя автора"); return; }
    if (!addForm.content.trim()) { toast.error("Укажите текст отзыва"); return; }
    setAddSaving(true);
    try {
      await reviewService.adminCreateExternal(addForm);
      toast.success("Отзыв добавлен и опубликован");
      setAddDialog(false);
      setAddForm(EMPTY_EXTERNAL);
      fetchReviews();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setAddSaving(false);
    }
  };

  const getAuthorDisplay = (review) => {
    if (!review.user_id) return review.admin_author_name || review.author_name || "—";
    if (review.is_anonymous) return "Аноним";
    return review.author_name || `${review.user?.first_name || ""} ${review.user?.last_name?.[0] || ""}`.trim() || "—";
  };

  const filtered = reviews.filter((r) => {
    const name = getAuthorDisplay(r);
    return `${name} ${r.content}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>
            <h1>Отзывы</h1>
            <p>
              Модерация отзывов пользователей и добавление внешних отзывов
              с 2ГИС, Яндекс и других платформ.
            </p>
          </div>
          <div className="admin-module__actions">
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate("/dashboard")}
              className="admin-module__button admin-module__button--ghost"
            >
              На главную
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddDialog(true)}
              className="admin-module__button admin-module__button--primary"
            >
              Добавить внешний отзыв
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Поиск по автору или тексту..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Статус</InputLabel>
              <Select
                value={statusFilter}
                label="Статус"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="pending">На модерации</MenuItem>
                <MenuItem value="approved">Одобренные</MenuItem>
                <MenuItem value="rejected">Отклонённые</MenuItem>
              </Select>
            </FormControl>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Автор</TableCell>
                    <TableCell>Источник</TableCell>
                    <TableCell>Оценка</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>{getAuthorDisplay(review)}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>
                        {review.source_platform || (review.user_id ? "Сайт" : "—")}
                      </TableCell>
                      <TableCell>
                        <Rating value={review.rating} readOnly size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[review.status] || review.status}
                          color={STATUS_COLORS[review.status] || "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(review.created_at).toLocaleDateString("ru")}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Просмотр">
                          <IconButton size="small" color="info" onClick={() => setViewDialog({ open: true, review })}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {review.status === "pending" && (
                          <>
                            <Tooltip title="Одобрить">
                              <IconButton size="small" color="success" onClick={() => handleApprove(review.id)}>
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Отклонить">
                              <IconButton size="small" color="error" onClick={() => handleReject(review.id)}>
                                <RejectIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Редактировать">
                          <IconButton size="small" onClick={() => handleEdit(review)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" onClick={() => handleDelete(review.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">Отзывы не найдены</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        {/* View Dialog */}
        <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, review: null })} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">Просмотр отзыва</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            {viewDialog.review && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Автор: {getAuthorDisplay(viewDialog.review)}
                  {viewDialog.review.source_platform && ` (${viewDialog.review.source_platform})`}
                </Typography>
                <Rating value={viewDialog.review.rating} readOnly sx={{ my: 1 }} />
                <Typography variant="body1">{viewDialog.review.content}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setViewDialog({ open: false, review: null })}>Закрыть</Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, review: null })} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">Редактировать отзыв</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>Оценка</Typography>
              <Rating
                value={editData.rating}
                onChange={(_, v) => setEditData({ ...editData, rating: v })}
                sx={{ mb: 2 }}
              />
            </Box>
            <TextField
              fullWidth multiline rows={4}
              label="Текст отзыва"
              value={editData.content}
              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
            />
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setEditDialog({ open: false, review: null })}>Отмена</Button>
            <Button onClick={handleSaveEdit} variant="contained">Сохранить</Button>
          </DialogActions>
        </Dialog>

        {/* Add External Review Dialog */}
        <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
          <DialogTitle className="admin-module-dialog__title">Добавить внешний отзыв</DialogTitle>
          <DialogContent className="admin-module-dialog__content">
            <Box display="flex" gap={2}>
              <TextField
                label="Имя автора"
                value={addForm.author_name}
                onChange={(e) => setAddForm({ ...addForm, author_name: e.target.value })}
                fullWidth required
                placeholder="Елена, мама"
              />
              <TextField
                label="Платформа"
                value={addForm.source_platform}
                onChange={(e) => setAddForm({ ...addForm, source_platform: e.target.value })}
                fullWidth
                placeholder="2ГИС"
                helperText={PLATFORMS.join(", ")}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>Оценка</Typography>
              <Rating value={addForm.rating} onChange={(_, v) => setAddForm({ ...addForm, rating: v || 5 })} max={5} />
            </Box>
            <TextField
              label="Текст отзыва" fullWidth required multiline rows={4}
              value={addForm.content}
              onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
            />
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setAddDialog(false)}>Отмена</Button>
            <Button onClick={handleAddExternal} variant="contained" disabled={addSaving}>
              {addSaving ? "Сохранение..." : "Опубликовать"}
            </Button>
          </DialogActions>
        </Dialog>

      </div>
    </main>
  );
};

export default AdminReviews;
