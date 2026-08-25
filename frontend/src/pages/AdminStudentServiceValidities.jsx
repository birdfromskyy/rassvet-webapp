import "./AdminModule.scss";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Chip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  FactCheck as ValidityIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import useBrandFont from "../hooks/useBrandFont";
import scheduleService from "../services/scheduleService";

const SERVICE_LABELS = {
  ippsu: "ИППСУ",
  massage: "Массаж",
  adaptive_physical_culture: "Адаптивная физкультура",
};

const formatDate = (value) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("ru-RU");

const dayWord = (days) => {
  const lastTwo = days % 100;
  const last = days % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
};

const getDeadlineState = (value) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${value.slice(0, 10)}T00:00:00`);
  const days = Math.ceil((deadline - today) / 86400000);
  if (days < 0) return { label: "Срок истёк", color: "error" };
  if (days <= 7) return { label: days === 0 ? "Истекает сегодня" : `Осталось ${days} дн.`, color: "warning" };
  return { label: `Действует ещё ${days} ${dayWord(days)}`, color: "success" };
};

const AdminStudentServiceValidities = () => {
  useBrandFont();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [sort, setSort] = useState("asc");

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setRows(await scheduleService.getStudentServiceValidityList({
          student: student.trim() || undefined,
          service_type: serviceType || undefined,
          sort,
        }));
      } catch (error) {
        toast.error(error.response?.data?.error || "Ошибка загрузки сроков услуг");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [student, serviceType, sort]);

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">Расписание</span>
            <h1>Сроки услуг</h1>
            <p>Единый список сроков ИППСУ, массажа и адаптивной физкультуры. Сначала отображаются ближайшие сроки.</p>
          </div>
          <div className="admin-module__actions">
            <Button startIcon={<BackIcon />} onClick={() => navigate("/admin/schedule")} className="admin-module__button admin-module__button--ghost">
              Назад
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar admin-module__toolbar--filters">
            <div className="admin-module__search">
              <SearchIcon />
              <input value={student} onChange={(event) => setStudent(event.target.value)} placeholder="Поиск по ФИО ученика..." aria-label="Поиск по ФИО ученика" />
            </div>
            <Box className="admin-module__filter-fields">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="validity-type-label">Тип срока</InputLabel>
                <Select labelId="validity-type-label" label="Тип срока" value={serviceType} onChange={(event) => setServiceType(event.target.value)}>
                  <MenuItem value="">Все типы</MenuItem>
                  <MenuItem value="ippsu">ИППСУ</MenuItem>
                  <MenuItem value="massage">Массаж</MenuItem>
                  <MenuItem value="adaptive_physical_culture">Адаптивная физкультура</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 230 }}>
                <InputLabel id="validity-sort-label">Сортировка</InputLabel>
                <Select labelId="validity-sort-label" label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <MenuItem value="asc">Сначала ближайшие</MenuItem>
                  <MenuItem value="desc">Сначала дальние</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </div>

          <div className="admin-module__count">Найдено: {rows.length}</div>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : rows.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <ValidityIcon sx={{ fontSize: 38, mb: 1, opacity: 0.55 }} />
              <Typography>Сроки по выбранным условиям не найдены.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ученик</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Срок действия</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const state = getDeadlineState(row.valid_until);
                    return (
                      <TableRow key={row.id}>
                        <TableCell sx={{ fontWeight: 700 }}>{row.student?.full_name || "—"}</TableCell>
                        <TableCell>{SERVICE_LABELS[row.service_type] || row.service_type}</TableCell>
                        <TableCell>{formatDate(row.valid_until)}</TableCell>
                        <TableCell><Chip size="small" label={state.label} color={state.color} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>
      </div>
    </main>
  );
};

export default AdminStudentServiceValidities;
