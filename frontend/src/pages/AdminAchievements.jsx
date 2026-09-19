import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Chip,
  Paper,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Visibility as PreviewIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import achievementService, { getUploadUrl } from "../services/achievementService";
import { uploadFile } from "../services/cmsService";
import "./AdminModule.scss";

const MODULE_TITLE = "Истории успеха";
const PUBLIC_PAGE_URL = "/achievements";
const BLOCK_TYPES = [
  { type: "text", label: "Текст", icon: TextIcon },
  { type: "image", label: "Фотография", icon: ImageIcon },
  { type: "video", label: "Видео по ссылке", icon: VideoIcon },
];
const emptyForm = { child_name: "", conclusion: "", is_visible: true, sort_order: 0 };

export default function AdminAchievements() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingBlock, setUploadingBlock] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await achievementService.adminGetAll());
    } catch {
      toast.error("Ошибка загрузки историй");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredList = list.filter((item) => {
    const value = `${item.child_name || ""} ${item.conclusion || ""} ${item.preview_text || ""}`.toLowerCase();
    return value.includes(search.toLowerCase().trim());
  });

  const openCreate = () => {
    const nextOrder = list.length ? Math.max(...list.map((item) => item.sort_order ?? 0)) + 1 : 1;
    setEditing(null);
    setForm({ ...emptyForm, sort_order: nextOrder });
    setBlocks([]);
    setOpen(true);
  };

  const openEdit = async (item) => {
    try {
      const full = await achievementService.adminGetById(item.id);
      setEditing(full);
      setForm({
        child_name: full.child_name || "",
        conclusion: full.conclusion || "",
        is_visible: full.is_visible,
        sort_order: full.sort_order ?? 0,
      });
      setBlocks((full.blocks || []).map((block) => ({
        type: block.type,
        content: block.content || "",
        title: block.title || "",
      })));
      setOpen(true);
    } catch {
      toast.error("Не удалось открыть историю");
    }
  };

  const handleSave = async () => {
    if (!form.child_name.trim()) {
      toast.error("Введите имя ребёнка");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        child_name: form.child_name.trim(),
        conclusion: form.conclusion.trim(),
        sort_order: Number(form.sort_order) || 0,
        blocks: blocks.map((block) => ({
          type: block.type,
          content: block.content || "",
          title: block.title || "",
        })),
      };
      if (editing) await achievementService.adminUpdate(editing.id, payload);
      else await achievementService.adminCreate(payload);
      toast.success(editing ? "История обновлена" : "История создана");
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить историю и её фотографии?")) return;
    try {
      await achievementService.adminDelete(id);
      toast.success("История удалена");
      load();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const addBlock = (type) => setBlocks((current) => [...current, { type, content: "", title: "" }]);
  const updateBlock = (index, patch) => setBlocks((current) => current.map((block, itemIndex) => itemIndex === index ? { ...block, ...patch } : block));
  const removeBlock = (index) => setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const handleImageUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingBlock(index);
    try {
      const imageURL = await uploadFile(file);
      updateBlock(index, { content: imageURL });
    } catch {
      toast.error("Ошибка загрузки фотографии");
    } finally {
      setUploadingBlock(null);
      event.target.value = "";
    }
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>
            <h1>{MODULE_TITLE}</h1>
            <p>Создавайте историю из текста, фотографий и видео, располагая материалы в нужном порядке.</p>
          </div>
          <div className="admin-module__actions">
            <Button startIcon={<BackIcon />} onClick={() => navigate("/admin/cms")} className="admin-module__button admin-module__button--ghost">Назад</Button>
            <Button component="a" href={PUBLIC_PAGE_URL} target="_blank" rel="noreferrer" className="admin-module__button admin-module__button--outline">Перейти на страницу</Button>
            <Button startIcon={<AddIcon />} onClick={openCreate} className="admin-module__button admin-module__button--primary">Добавить историю</Button>
          </div>
        </section>

        <div className="admin-users-stats">
          <div className="admin-users-stat"><span>Всего историй</span><strong>{list.length}</strong></div>
          <div className="admin-users-stat"><span>Опубликовано</span><strong>{list.filter((item) => item.is_visible).length}</strong></div>
          <div className="admin-users-stat"><span>Скрыто</span><strong>{list.filter((item) => !item.is_visible).length}</strong></div>
        </div>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search"><SearchIcon /><input type="text" placeholder="Поиск по историям..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <span className="admin-module__count">Найдено: {filteredList.length}</span>
          </div>

          {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : filteredList.length === 0 ? <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Истории не найдены</Typography> : (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.5 }}>
              {filteredList.map((item) => (
                <Card key={item.id} className="admin-achievement-card" sx={{ opacity: item.is_visible ? 1 : 0.65 }}>
                  <Box className="admin-achievement-card__media">
                    {item.preview_image_url ? <img src={getUploadUrl(item.preview_image_url)} alt={item.child_name} /> : <span>Без фотографии</span>}
                  </Box>
                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ color: "#074462", fontWeight: 900 }}>{item.child_name}</Typography>
                    {item.preview_text && <Typography variant="body2" color="text.secondary" className="admin-achievement-card__excerpt">{item.preview_text}</Typography>}
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={1}>
                      <Chip label={item.is_visible ? "Опубликована" : "Скрыта"} color={item.is_visible ? "success" : "default"} size="small" />
                      <Chip label={`Порядок: ${item.sort_order}`} size="small" variant="outlined" />
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Tooltip title="Предпросмотр"><IconButton size="small" color="info" onClick={() => navigate(`/admin/achievements/${item.id}/preview`)}><PreviewIcon /></IconButton></Tooltip>
                    <Tooltip title="Редактировать"><IconButton size="small" onClick={() => openEdit(item)}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Удалить"><IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon /></IconButton></Tooltip>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </section>

        <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth PaperProps={{ className: "admin-module-dialog", sx: { maxHeight: "92vh" } }}>
          <DialogTitle className="admin-module-dialog__title">{editing ? "Редактировать историю" : "Добавить историю успеха"}</DialogTitle>
          <DialogContent dividers className="admin-module-dialog__content">
            <TextField label="Имя ребёнка" value={form.child_name} required fullWidth onChange={(event) => setForm((current) => ({ ...current, child_name: event.target.value }))} />
            <TextField label="Финальная фраза" value={form.conclusion} fullWidth onChange={(event) => setForm((current) => ({ ...current, conclusion: event.target.value }))} placeholder="Маленькими шагами к большим возможностям!" />

            <Box className="admin-achievement-builder__heading">
              <Typography variant="h6">Содержание истории</Typography>
              <Typography variant="body2" color="text.secondary">Добавляйте блоки и меняйте их порядок стрелками.</Typography>
            </Box>

            {blocks.map((block, index) => (
              <AchievementBlockEditor
                key={index}
                block={block}
                index={index}
                total={blocks.length}
                uploading={uploadingBlock === index}
                onChange={(patch) => updateBlock(index, patch)}
                onRemove={() => removeBlock(index)}
                onMove={(direction) => moveBlock(index, direction)}
                onImageUpload={(event) => handleImageUpload(index, event)}
              />
            ))}

            <Box display="flex" gap={1} flexWrap="wrap">
              {BLOCK_TYPES.map(({ type, label, icon: Icon }) => <Button key={type} size="small" variant="outlined" startIcon={<Icon />} onClick={() => addBlock(type)}>+ {label}</Button>)}
            </Box>

            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <TextField label="Порядок сортировки" type="number" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} sx={{ width: 220 }} />
              <FormControlLabel control={<Switch checked={form.is_visible} onChange={(event) => setForm((current) => ({ ...current, is_visible: event.target.checked }))} />} label="Отображать на сайте" />
            </Box>
          </DialogContent>
          <DialogActions className="admin-module-dialog__actions"><Button onClick={() => setOpen(false)} disabled={saving}>Отмена</Button><Button variant="contained" onClick={handleSave} disabled={saving || !form.child_name.trim()}>{saving ? "Сохранение..." : "Сохранить"}</Button></DialogActions>
        </Dialog>
      </div>
    </main>
  );
}

function AchievementBlockEditor({ block, index, total, uploading, onChange, onRemove, onMove, onImageUpload }) {
  const typeInfo = BLOCK_TYPES.find((item) => item.type === block.type) || BLOCK_TYPES[0];
  const Icon = typeInfo.icon;
  return (
    <Paper variant="outlined" className="admin-achievement-builder__block">
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <Icon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{typeInfo.label}</Typography>
        <Tooltip title="Выше"><span><IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0}><UpIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Ниже"><span><IconButton size="small" onClick={() => onMove(1)} disabled={index === total - 1}><DownIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Удалить блок"><IconButton size="small" color="error" onClick={onRemove}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Box>

      {block.type === "text" && <TextField label="Текст" value={block.content} onChange={(event) => onChange({ content: event.target.value })} fullWidth multiline minRows={4} placeholder="Введите текст..." />}
      {block.type === "image" && <Box>
        {block.content && <img className="admin-achievement-builder__preview" src={getUploadUrl(block.content)} alt="Предпросмотр" />}
        <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
          <Button variant="outlined" component="label" disabled={uploading}>{uploading ? "Загружается..." : block.content ? "Заменить фотографию" : "Загрузить фотографию"}<input type="file" accept="image/*" hidden onChange={onImageUpload} /></Button>
          {block.content && <Button color="error" onClick={() => onChange({ content: "" })}>Убрать</Button>}
        </Box>
        <TextField label="Подпись к фотографии" value={block.title} onChange={(event) => onChange({ title: event.target.value })} fullWidth />
      </Box>}
      {block.type === "video" && <TextField label="Ссылка на видео" value={block.content} onChange={(event) => onChange({ content: event.target.value })} fullWidth placeholder="https://vkvideo.ru/video-..." helperText="Поддерживается ссылка на VK Видео или другая безопасная ссылка http/https." />}
    </Paper>
  );
}
