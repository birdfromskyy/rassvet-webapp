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
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Tooltip,
  Paper,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  ArrowBack as BackIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  InsertDriveFile as FileIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import newsService from "../services/newsService";
import { uploadFile, getUploadUrl } from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Новости";
const PUBLIC_PAGE_URL = "/news";

const CATEGORIES = [
  { value: "news", label: "Новости" },
  { value: "articles", label: "Статьи" },
  { value: "updates", label: "Обновления" },
  { value: "events", label: "События" },
];

const BLOCK_TYPES = [
  { type: "text", label: "Текст", icon: TextIcon },
  { type: "image", label: "Изображение", icon: ImageIcon },
  { type: "video", label: "Видео", icon: VideoIcon },
  { type: "file", label: "Файл", icon: FileIcon },
];

const emptyMeta = {
  title: "",
  slug: "",
  summary: "",
  category: "news",
  tags: "",
  featured_image: "",
  status: "draft",
};

const TRANSLIT = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const slugify = (str) => {
  const translit = str
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("");

  return translit
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export default function AdminNews() {
  const navigate = useNavigate();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const filteredArticles = articles.filter((article) => {
    const value = `${article.title} ${article.slug} ${
      article.summary || ""
    }`.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  const load = () => {
    setLoading(true);
    newsService
      .getAllArticles()
      .then(setArticles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setMeta(emptyMeta);
    setBlocks([]);
    setOpen(true);
  };

  const openEdit = async (article) => {
    setEditing(article);
    setMeta({
      title: article.title,
      slug: article.slug,
      summary: article.summary || "",
      category: article.category || "news",
      tags: article.tags || "",
      featured_image: article.featured_image || "",
      status: article.status || "draft",
    });

    try {
      const full = await newsService.getArticleById(article.id);
      setBlocks(full.blocks || []);
    } catch {
      setBlocks([]);
    }

    setOpen(true);
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setMeta((m) => ({
      ...m,
      title,
      slug: editing ? m.slug : slugify(title),
    }));
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadFile(file);
      setMeta((m) => ({ ...m, featured_image: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!meta.title || !meta.slug) {
      toast.error("Укажите заголовок и slug");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...meta,
        blocks: blocks.map((b, i) => ({ ...b, sort_order: i })),
      };

      if (editing) {
        await newsService.updateArticle(editing.id, payload);
        toast.success("Новость обновлена");
      } else {
        await newsService.createArticle(payload);
        toast.success("Новость создана");
      }

      setOpen(false);
      load();
    } catch (e) {
      const msg = e.response?.data?.error || "";
      toast.error(
        msg === "slug already exists"
          ? "Такой slug уже занят — измените его"
          : msg || "Ошибка сохранения"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить новость?")) return;

    await newsService.deleteArticle(id);
    load();
  };

  const addBlock = (type) =>
    setBlocks((bs) => [...bs, { type, content: "", title: "" }]);

  const updateBlock = (idx, patch) =>
    setBlocks((bs) => bs.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const removeBlock = (idx) => setBlocks((bs) => bs.filter((_, i) => i !== idx));

  const moveBlock = (idx, dir) => {
    const next = [...blocks];
    const swap = idx + dir;

    if (swap < 0 || swap >= next.length) return;

    [next[idx], next[swap]] = [next[swap], next[idx]];
    setBlocks(next);
  };

  const handleBlockImageUpload = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file);
      updateBlock(idx, { content: url });
    } catch {
      toast.error("Ошибка загрузки изображения");
    }
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление новостями, статьями, публикациями, обложками,
              медиафайлами и содержимым новостного раздела сайта.
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
              component="a"
              href={PUBLIC_PAGE_URL}
              target="_blank"
              rel="noreferrer"
              className="admin-module__button admin-module__button--outline"
            >
              Перейти на страницу
            </Button>

            <Button
              startIcon={<AddIcon />}
              onClick={openCreate}
              className="admin-module__button admin-module__button--primary"
            >
              Добавить новость
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по новостям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Заголовок</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Категория</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredArticles.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.title}</TableCell>

                      <TableCell>
                        <code>{a.slug}</code>
                      </TableCell>

                      <TableCell>
                        {CATEGORIES.find((c) => c.value === a.category)
                          ?.label || a.category}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={
                            a.status === "published"
                              ? "Опубликована"
                              : "Черновик"
                          }
                          size="small"
                          color={
                            a.status === "published" ? "success" : "default"
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString("ru")
                          : "—"}
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip
                          title={
                            a.status === "draft"
                              ? "Просмотр черновика"
                              : "Просмотр"
                          }
                        >
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() =>
                              navigate(`/admin/news/${a.id}/preview`)
                            }
                          >
                            <PreviewIcon />
                          </IconButton>
                        </Tooltip>

                        <IconButton size="small" onClick={() => openEdit(a)}>
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(a.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredArticles.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          Новости не найдены
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

<Dialog
  open={open}
  onClose={() => setOpen(false)}
  maxWidth="md"
  fullWidth
  PaperProps={{
    className: "admin-module-dialog",
    sx: { maxHeight: "90vh" },
  }}
>
          <DialogTitle className="admin-module-dialog__title">
            {editing ? "Редактировать новость" : "Новая новость"}
          </DialogTitle>

<DialogContent
  dividers
  className="admin-module-dialog__content"
>
            <TextField
              label="Заголовок"
              value={meta.title}
              fullWidth
              required
              onChange={handleTitleChange}
            />

            <TextField
              label="Slug (URL)"
              value={meta.slug}
              fullWidth
              required
              onChange={(e) =>
                setMeta((m) => ({ ...m, slug: e.target.value }))
              }
              helperText="Авто-генерируется из заголовка. Только латиница и дефисы. Должен быть уникальным."
            />

            <TextField
              label="Краткое описание"
              value={meta.summary}
              fullWidth
              multiline
              rows={2}
              onChange={(e) =>
                setMeta((m) => ({ ...m, summary: e.target.value }))
              }
            />

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Категория</InputLabel>
                <Select
                  value={meta.category}
                  label="Категория"
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, category: e.target.value }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>
                      {c.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={meta.status}
                  label="Статус"
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, status: e.target.value }))
                  }
                >
                  <MenuItem value="draft">Черновик</MenuItem>
                  <MenuItem value="published">Опубликована</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="Теги (через запятую)"
              value={meta.tags}
              onChange={(e) =>
                setMeta((m) => ({ ...m, tags: e.target.value }))
              }
              fullWidth
            />

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Обложка
              </Typography>

              {meta.featured_image && (
                <Box mb={1}>
                  <img
                    src={getUploadUrl(meta.featured_image)}
                    alt=""
                    height={80}
                    style={{ borderRadius: 4, objectFit: "cover" }}
                  />
                </Box>
              )}

              <Button
                variant="outlined"
                component="label"
                disabled={uploading}
                size="small"
              >
                {uploading ? "Загружается..." : "Загрузить обложку"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleCoverUpload}
                />
              </Button>

              {meta.featured_image && (
                <Button
                  size="small"
                  color="error"
                  sx={{ ml: 1 }}
                  onClick={() =>
                    setMeta((m) => ({ ...m, featured_image: "" }))
                  }
                >
                  Удалить
                </Button>
              )}
            </Box>

            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary">
                Содержимое новости
              </Typography>
            </Divider>

            {blocks.map((block, idx) => (
              <BlockEditor
                key={idx}
                block={block}
                idx={idx}
                total={blocks.length}
                onChange={(patch) => updateBlock(idx, patch)}
                onRemove={() => removeBlock(idx)}
                onMove={(dir) => moveBlock(idx, dir)}
                onImageUpload={(e) => handleBlockImageUpload(idx, e)}
              />
            ))}

            <Box display="flex" gap={1} flexWrap="wrap">
              {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  size="small"
                  variant="outlined"
                  startIcon={<Icon />}
                  onClick={() => addBlock(type)}
                >
                  + {label}
                </Button>
              ))}
            </Box>
          </DialogContent>

          <DialogActions className="admin-module-dialog__actions">
            <Button onClick={() => setOpen(false)}>Отмена</Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !meta.title || !meta.slug}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </main>
  );
}

function BlockEditor({
  block,
  idx,
  total,
  onChange,
  onRemove,
  onMove,
  onImageUpload,
}) {
  const typeInfo =
    BLOCK_TYPES.find((t) => t.type === block.type) || BLOCK_TYPES[0];
  const Icon = typeInfo.icon;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Icon fontSize="small" color="action" />

        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {typeInfo.label}
        </Typography>

        <Tooltip title="Вверх">
          <span>
            <IconButton
              size="small"
              onClick={() => onMove(-1)}
              disabled={idx === 0}
            >
              <UpIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Вниз">
          <span>
            <IconButton
              size="small"
              onClick={() => onMove(1)}
              disabled={idx === total - 1}
            >
              <DownIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {block.type === "text" && (
        <TextField
          label="Текст"
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          fullWidth
          multiline
          rows={4}
          placeholder="Введите текст абзаца..."
        />
      )}

      {block.type === "image" && (
        <Box>
          {block.content && (
            <Box mb={1}>
              <img
                src={getUploadUrl(block.content)}
                alt=""
                height={100}
                style={{ borderRadius: 4, objectFit: "cover" }}
              />
            </Box>
          )}

          <Button variant="outlined" component="label" size="small">
            {block.content ? "Заменить изображение" : "Загрузить изображение"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={onImageUpload}
            />
          </Button>

          {block.content && (
            <Button
              size="small"
              color="error"
              sx={{ ml: 1 }}
              onClick={() => onChange({ content: "" })}
            >
              Удалить
            </Button>
          )}
        </Box>
      )}

      {block.type === "video" && (
        <TextField
          label="URL видео (ВКонтакте или YouTube)"
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          fullWidth
          placeholder="https://vk.com/video..."
        />
      )}

      {block.type === "file" && (
        <Box display="flex" flexDirection="column" gap={1}>
          <TextField
            label="Название файла (для отображения)"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            fullWidth
            placeholder="Скачать документ"
          />

          <TextField
            label="URL файла"
            value={block.content}
            onChange={(e) => onChange({ content: e.target.value })}
            fullWidth
            placeholder="https://..."
            helperText="Прямая ссылка на файл (Яндекс Диск, Google Drive и т.д.)"
          />
        </Box>
      )}
    </Paper>
  );
}