import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tabs,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import commercialTariffService from "../services/commercialTariffService";
import scheduleService from "../services/scheduleService";
import "./AdminModule.scss";
import "./AdminCommercialTariffs.scss";

const PAGE_TITLE = "Тарифы на коммерческие услуги";
const PUBLIC_PAGE_URL = "/commercial-tariffs";
const EMPTY_FORM = {
  service_name: "",
  volume_label: "",
  price: "",
  sort_order: 0,
  is_active: true,
};
const EMPTY_RULE_FORM = {
  subject_id: "",
  slot_type: "individual",
  duration_minutes: "",
  commercial_tariff_id: "",
  is_active: true,
};

const priceLabel = (tariff) =>
  tariff.price_rub !== null && tariff.price_rub !== undefined
    ? new Intl.NumberFormat("ru-RU").format(tariff.price_rub)
    : tariff.price_note || "—";

export default function AdminCommercialTariffs() {
  const navigate = useNavigate();
  const [tariffs, setTariffs] = useState([]);
  const [rules, setRules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [ruleSaving, setRuleSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      commercialTariffService.getAllAdmin(),
      commercialTariffService.getReportRules(),
      scheduleService.getSubjects(),
    ])
      .then(([tariffItems, ruleItems, subjectItems]) => {
        setTariffs(tariffItems);
        setRules(ruleItems);
        setSubjects(subjectItems);
      })
      .catch(() => toast.error("Не удалось загрузить тарифы"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTariffs = tariffs.filter((tariff) =>
    `${tariff.service_name} ${tariff.volume_label} ${tariff.price_note || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const activeCount = tariffs.filter((tariff) => tariff.is_active).length;
  const hiddenCount = tariffs.length - activeCount;

  const updateField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: tariffs.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (tariff) => {
    setEditing(tariff);
    setForm({
      service_name: tariff.service_name,
      volume_label: tariff.volume_label,
      price: tariff.price_rub ?? tariff.price_note ?? "",
      sort_order: tariff.sort_order,
      is_active: tariff.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (!saving) {
      setDialogOpen(false);
      setEditing(null);
    }
  };

  const handleSave = async () => {
    if (!form.service_name.trim() || !form.volume_label.trim()) {
      toast.error("Укажите название услуги и объём");
      return;
    }
    if (!String(form.price).trim()) {
      toast.error("Укажите тариф");
      return;
    }

    const priceText = String(form.price).trim();
    const numericPrice = /^\d+$/.test(priceText) ? Number(priceText) : null;

    const payload = {
      service_name: form.service_name.trim(),
      volume_label: form.volume_label.trim(),
      duration_minutes: null,
      price_rub: numericPrice,
      price_note: numericPrice === null ? priceText : "",
      effective_from: "2026-01-01T00:00:00Z",
      effective_to: null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing) {
        await commercialTariffService.update(editing.id, payload);
        toast.success("Тариф обновлён");
      } else {
        await commercialTariffService.create(payload);
        toast.success("Тариф добавлен");
      }
      setDialogOpen(false);
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось сохранить тариф");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tariff) => {
    if (!window.confirm(`Удалить тариф «${tariff.service_name} — ${tariff.volume_label}» без возможности восстановления? Связанные правила отчётности также будут удалены.`)) {
      return;
    }
    try {
      await commercialTariffService.delete(tariff.id);
      toast.success("Тариф удалён");
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось удалить тариф");
    }
  };

  const updateRuleField = (field) => (event) =>
    setRuleForm((current) => ({ ...current, [field]: event.target.value }));

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm(EMPTY_RULE_FORM);
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      subject_id: rule.subject_id || "",
      slot_type: rule.slot_type,
      duration_minutes: rule.duration_minutes,
      commercial_tariff_id: rule.commercial_tariff_id,
      is_active: rule.is_active,
    });
    setRuleDialogOpen(true);
  };

  const closeRuleDialog = () => {
    if (!ruleSaving) {
      setRuleDialogOpen(false);
      setEditingRule(null);
    }
  };

  const availableTariffs = tariffs.filter((tariff) =>
    tariff.price_rub !== null && tariff.price_rub !== undefined &&
    (!ruleForm.duration_minutes || tariff.duration_minutes === Number(ruleForm.duration_minutes))
  );

  const handleSaveRule = async () => {
    if (!ruleForm.duration_minutes || !ruleForm.commercial_tariff_id) {
      toast.error("Выберите длительность и тариф");
      return;
    }
    if (ruleForm.slot_type === "individual" && !ruleForm.subject_id) {
      toast.error("Выберите предмет для индивидуального занятия");
      return;
    }
    const payload = {
      subject_id: ruleForm.slot_type === "group" ? null : Number(ruleForm.subject_id),
      slot_type: ruleForm.slot_type,
      duration_minutes: Number(ruleForm.duration_minutes),
      commercial_tariff_id: Number(ruleForm.commercial_tariff_id),
      is_active: ruleForm.is_active,
    };
    setRuleSaving(true);
    try {
      if (editingRule) {
        await commercialTariffService.updateReportRule(editingRule.id, payload);
        toast.success("Правило обновлено");
      } else {
        await commercialTariffService.createReportRule(payload);
        toast.success("Правило добавлено");
      }
      setRuleDialogOpen(false);
      setEditingRule(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось сохранить правило");
    } finally {
      setRuleSaving(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm("Удалить правило тарификации без возможности восстановления? Занятия и расписание не изменятся.")) {
      return;
    }
    try {
      await commercialTariffService.deleteReportRule(rule.id);
      toast.success("Правило удалено");
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Не удалось удалить правило");
    }
  };

  return (
    <main className="admin-module admin-commercial-tariffs">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Расписание</span>
            <h1>{PAGE_TITLE}</h1>
            <p>
              Настройка текущей стоимости услуг и правил, по которым суммы попадают
              в отчётность по детям.
            </p>
          </div>
          <div className="admin-module__actions">
            <Button startIcon={<BackIcon />} onClick={() => navigate("/admin/schedule")} className="admin-module__button admin-module__button--ghost">
              Назад
            </Button>
            <Button component="a" href={PUBLIC_PAGE_URL} target="_blank" rel="noreferrer" className="admin-module__button admin-module__button--outline">
              Открыть страницу
            </Button>
            <Button startIcon={<AddIcon />} onClick={tab === 0 ? openCreate : openCreateRule} className="admin-module__button admin-module__button--primary">
              {tab === 0 ? "Добавить тариф" : "Добавить правило"}
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <Tabs value={tab} onChange={(_, value) => setTab(value)} className="tariff-admin-tabs">
            <Tab label="Тарифы на услуги" />
            <Tab label={`Тарифы для отчётности (${rules.length})`} />
          </Tabs>

          {tab === 0 && <>
          <div className="tariff-admin-summary" aria-label="Сводка по тарифам">
            <div className="tariff-admin-summary__item">
              <span>Всего записей</span>
              <strong>{tariffs.length}</strong>
            </div>
            <div className="tariff-admin-summary__item tariff-admin-summary__item--active">
              <span>Опубликовано</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="tariff-admin-summary__item tariff-admin-summary__item--hidden">
              <span>Скрыто</span>
              <strong>{hiddenCount}</strong>
            </div>
          </div>

          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по тарифам..." />
            </div>
            <span className="admin-module__count">Найдено: {filteredTariffs.length}</span>
          </div>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : (
            <TableContainer className="tariff-admin-table">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={88}>№ п/п</TableCell>
                    <TableCell>Наименование услуги</TableCell>
                    <TableCell>Объем услуги</TableCell>
                    <TableCell>Тарифы, руб.</TableCell>
                    <TableCell>Публикация</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTariffs.map((tariff) => (
                    <TableRow key={tariff.id}>
                      <TableCell data-label="№ п/п">
                        <span className="tariff-admin-order">{tariff.sort_order}</span>
                      </TableCell>
                      <TableCell data-label="Наименование">
                        <div className="tariff-admin-service">
                          <strong>{tariff.service_name}</strong>
                          <small>ID {tariff.id}</small>
                        </div>
                      </TableCell>
                      <TableCell data-label="Объем">
                        <span className="tariff-admin-volume">{tariff.volume_label}</span>
                      </TableCell>
                      <TableCell data-label="Тарифы, руб.">
                        <span className="tariff-admin-price">{priceLabel(tariff)}</span>
                      </TableCell>
                      <TableCell data-label="Публикация">
                        <Chip className={`tariff-admin-status tariff-admin-status--${tariff.is_active ? "active" : "hidden"}`} label={tariff.is_active ? "Опубликован" : "Скрыт"} size="small" />
                      </TableCell>
                      <TableCell align="right" data-label="Действия" className="tariff-admin-actions">
                        <IconButton aria-label={`Редактировать ${tariff.service_name}`} title="Редактировать" size="small" onClick={() => openEdit(tariff)}><EditIcon /></IconButton>
                        <IconButton aria-label={`Удалить ${tariff.service_name}`} title="Удалить" size="small" color="error" onClick={() => handleDelete(tariff)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredTariffs.length && (
                    <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Тарифы не найдены</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          </>}

          {tab === 1 && (loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer className="tariff-admin-table tariff-rule-table">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Тип занятия</TableCell>
                      <TableCell>Предмет</TableCell>
                      <TableCell>Длительность</TableCell>
                      <TableCell>Текущий тариф</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell align="right">Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell data-label="Тип занятия"><span className="tariff-admin-volume">{rule.slot_type === "group" ? "Групповое" : "Индивидуальное"}</span></TableCell>
                        <TableCell data-label="Предмет"><div className="tariff-admin-service"><strong>{rule.slot_type === "group" ? "Все групповые занятия" : rule.subject?.name || "Удалённый предмет"}</strong><small>Правило ID {rule.id}</small></div></TableCell>
                        <TableCell data-label="Длительность"><span className="tariff-admin-volume">{rule.duration_minutes} мин</span></TableCell>
                        <TableCell data-label="Текущий тариф"><span className="tariff-admin-price">{priceLabel(rule.commercial_tariff)}</span></TableCell>
                        <TableCell data-label="Статус"><Chip className={`tariff-admin-status tariff-admin-status--${rule.is_active ? "active" : "hidden"}`} label={rule.is_active ? "Учитывается" : "Отключено"} size="small" /></TableCell>
                        <TableCell align="right" data-label="Действия" className="tariff-admin-actions">
                          <IconButton title="Редактировать правило" size="small" onClick={() => openEditRule(rule)}><EditIcon /></IconButton>
                          <IconButton title="Удалить правило" size="small" color="error" onClick={() => handleDeleteRule(rule)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rules.length && <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Правила тарификации ещё не настроены. Занятия без правила будут иметь тариф 0 ₽.</Typography></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ))}
        </section>
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
        <DialogTitle className="admin-module-dialog__title">{editing ? "Редактировать тариф" : "Новый тариф"}</DialogTitle>
        <DialogContent className="admin-module-dialog__content">
          <TextField label="Наименование услуги" value={form.service_name} onChange={updateField("service_name")} fullWidth required multiline rows={2} />
          <TextField label="Объём услуги" value={form.volume_label} onChange={updateField("volume_label")} fullWidth required placeholder="Например, 50 мин или 1 комплексный обед" />
          <TextField label="Тариф, ₽" value={form.price} onChange={updateField("price")} fullWidth placeholder="Например, 1860 или Цена договорная" />
          <TextField label="Порядок отображения" value={form.sort_order} onChange={updateField("sort_order")} fullWidth type="number" inputProps={{ min: 0 }} />
          <FormControlLabel control={<Switch checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />} label="Показывать на публичной странице" />
        </DialogContent>
        <DialogActions className="admin-module-dialog__actions">
          <Button onClick={closeDialog} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving} className="admin-module__button admin-module__button--primary">{saving ? "Сохраняем…" : "Сохранить"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ruleDialogOpen} onClose={closeRuleDialog} maxWidth="sm" fullWidth PaperProps={{ className: "admin-module-dialog" }}>
        <DialogTitle className="admin-module-dialog__title">{editingRule ? "Редактировать правило тарификации" : "Новое правило тарификации"}</DialogTitle>
        <DialogContent className="admin-module-dialog__content">
          <TextField select label="Тип занятия" value={ruleForm.slot_type} onChange={(event) => setRuleForm((current) => ({ ...current, slot_type: event.target.value, subject_id: event.target.value === "group" ? "" : current.subject_id }))} fullWidth>
            <MenuItem value="individual">Индивидуальное</MenuItem>
            <MenuItem value="group">Групповое</MenuItem>
          </TextField>
          {ruleForm.slot_type === "individual" && (
            <TextField select label="Предмет" value={ruleForm.subject_id} onChange={updateRuleField("subject_id")} fullWidth required>
              <MenuItem value="">Выберите предмет</MenuItem>
              {subjects.filter((subject) => subject.is_active).map((subject) => <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>)}
            </TextField>
          )}
          <TextField
            label="Длительность, мин"
            value={ruleForm.duration_minutes}
            onChange={(event) => setRuleForm((current) => ({ ...current, duration_minutes: event.target.value, commercial_tariff_id: "" }))}
            fullWidth
            required
            type="number"
            inputProps={{ min: 1, step: 1 }}
            helperText="Укажите фактическую длительность занятия."
          />
          <TextField select label="Тариф из справочника" value={ruleForm.commercial_tariff_id} onChange={updateRuleField("commercial_tariff_id")} fullWidth required disabled={!ruleForm.duration_minutes}>
            <MenuItem value="">Выберите тариф</MenuItem>
            {availableTariffs.map((tariff) => <MenuItem key={tariff.id} value={tariff.id}>{tariff.service_name} — {tariff.volume_label} ({priceLabel(tariff)})</MenuItem>)}
          </TextField>
          <FormControlLabel control={<Switch checked={ruleForm.is_active} onChange={(event) => setRuleForm((current) => ({ ...current, is_active: event.target.checked }))} />} label="Учитывать в отчётности" />
        </DialogContent>
        <DialogActions className="admin-module-dialog__actions">
          <Button onClick={closeRuleDialog} disabled={ruleSaving}>Отмена</Button>
          <Button onClick={handleSaveRule} disabled={ruleSaving} className="admin-module__button admin-module__button--primary">{ruleSaving ? "Сохраняем…" : "Сохранить"}</Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}
