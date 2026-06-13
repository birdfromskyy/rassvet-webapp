import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import NewsSection from "../../components/NewsSection/NewsSection";

import authService from "../../services/authService";
import scheduleService from "../../services/scheduleService";
import { isAdmin as isAdminRole, isTeacher as isTeacherRole } from "../../utils/roles";
import questionnaireService from "../../services/questionnaireService";
import { siteSettingService, getUploadUrl } from "../../services/cmsService";

import { toast } from "react-toastify";

import "./Dashboard.scss";

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateISO = (date) => date.toISOString().split("T")[0];

const getTodayWeekday = () => {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
};

const getSlotSubject = (slot) =>
  slot.subject?.name || slot.group_lesson?.name || "Занятие";

const getSlotStudentLabel = (slot) => {
  if (slot.slot_type !== "group") return slot.student?.full_name || "—";
  return (
    (slot.group_lesson?.enrollments || [])
      .map((enr) => enr.student?.full_name)
      .filter(Boolean)
      .join(", ") ||
    slot.group_lesson?.name ||
    "—"
  );
};

const getDuration = (start, end) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

const SlotItem = ({ slot, asTeacher }) => (
  <article className="dashboard-schedule__item" key={slot.id}>
    <div className="dashboard-schedule__time">
      {slot.start_time}–{slot.end_time}
      <span className="dashboard-schedule__duration">
        {getDuration(slot.start_time, slot.end_time)} мин
      </span>
    </div>
    <div className="dashboard-schedule__info">
      <h3>{asTeacher ? getSlotStudentLabel(slot) : getSlotSubject(slot)}</h3>
      <p>
        <span className="dashboard-schedule__label">Кабинет: </span>
        {slot.room_name || slot.room?.name || "не указан"}
      </p>
      <p className="dashboard-schedule__secondary">
        <span className="dashboard-schedule__label">
          {asTeacher ? "Предмет: " : "Преподаватель: "}
        </span>
        {asTeacher ? getSlotSubject(slot) : slot.teacher?.full_name || "—"}
      </p>
    </div>
  </article>
);

// Shows teacher's own schedule for today
const TeacherScheduleWidget = ({ user }) => {
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayWeekday = getTodayWeekday();
  const weekStartISO = formatDateISO(getMonday(new Date()));

  useEffect(() => {
    if (!user?.teacher_id) {
      setLoading(false);
      return;
    }
    scheduleService
      .getTeacherPublishedSchedule(weekStartISO, {
        teacher_id: user.teacher_id,
        student_id: "",
      })
      .then((data) =>
        setSlots((data.slots || []).filter((s) => s.weekday === todayWeekday))
      )
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [user, weekStartISO, todayWeekday]);

  return (
    <section className="dashboard-schedule">
      <div className="dashboard-schedule__top">
        <div>
          <span className="section-badge">Сегодня</span>
          <h2>Ваше расписание</h2>
        </div>
        <button onClick={() => navigate("/teacher/schedule")}>
          Посмотреть всё расписание
        </button>
      </div>

      {loading ? (
        <div className="dashboard-schedule__empty">Загружаем расписание...</div>
      ) : !user?.teacher_id ? (
        <div className="dashboard-schedule__empty">
          Аккаунт не привязан к преподавателю. Обратитесь к администратору.
        </div>
      ) : slots.length === 0 ? (
        <div className="dashboard-schedule__empty">На сегодня занятий нет</div>
      ) : (
        <div className="dashboard-schedule__list">
          {slots.map((slot) => (
            <SlotItem key={slot.id} slot={slot} asTeacher />
          ))}
        </div>
      )}
    </section>
  );
};

// Shows children's schedule for today (user or admin with linked children)
const ChildScheduleWidget = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [activeChildIndex, setActiveChildIndex] = useState(0);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayWeekday = getTodayWeekday();
  const weekStartISO = formatDateISO(getMonday(new Date()));
  const activeChild = children[activeChildIndex];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const childrenData = await scheduleService.getMyChildren();
        setChildren(childrenData);
        if (childrenData.length > 0) {
          const data = await scheduleService.getChildSchedule(
            childrenData[0].student_id,
            weekStartISO
          );
          setSlots(
            (data.slots || []).filter((s) => s.weekday === todayWeekday)
          );
        }
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weekStartISO, todayWeekday]);

  useEffect(() => {
    if (!activeChild) return;
    const loadChildSchedule = async () => {
      setLoading(true);
      try {
        const data = await scheduleService.getChildSchedule(
          activeChild.student_id,
          weekStartISO
        );
        setSlots(
          (data.slots || []).filter((s) => s.weekday === todayWeekday)
        );
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };
    loadChildSchedule();
  }, [activeChildIndex, activeChild, weekStartISO, todayWeekday]);

  return (
    <section className="dashboard-schedule">
      <div className="dashboard-schedule__top">
        <div>
          <span className="section-badge">Сегодня</span>
          <h2>Расписание ребёнка</h2>
        </div>
        <button onClick={() => navigate(`/my-schedule${activeChild ? `?studentId=${activeChild.student_id}` : ''}`)}>
          Посмотреть всё расписание
        </button>
      </div>

      {children.length > 1 && (
        <div className="dashboard-schedule__switcher">
          <button
            onClick={() =>
              setActiveChildIndex((p) =>
                p === 0 ? children.length - 1 : p - 1
              )
            }
          >
            ←
          </button>
          <span>{activeChild?.student?.full_name}</span>
          <button
            onClick={() =>
              setActiveChildIndex((p) =>
                p === children.length - 1 ? 0 : p + 1
              )
            }
          >
            →
          </button>
        </div>
      )}

      {loading ? (
        <div className="dashboard-schedule__empty">Загружаем расписание...</div>
      ) : slots.length === 0 ? (
        <div className="dashboard-schedule__empty">На сегодня занятий нет</div>
      ) : (
        <div className="dashboard-schedule__list">
          {slots.map((slot) => (
            <SlotItem key={slot.id} slot={slot} asTeacher={false} />
          ))}
        </div>
      )}
    </section>
  );
};

// Status banner config — colour + messaging per questionnaire state
const Q_STATUS = {
  pending: {
    bg: "#fefce8", border: "#fde047", color: "#854d0e",
    icon: "⏳",
    title: "Анкета отправлена и находится на проверке",
    body: "Как только администратор примет решение — вы получите уведомление.",
  },
  approved: {
    bg: "#f0fdf4", border: "#86efac", color: "#166534",
    icon: "✅",
    title: "Анкета принята!",
    body: "Администратор одобрил вашу анкету. Теперь можно подать документы.",
  },
  rejected: {
    bg: "#fff1f2", border: "#fca5a5", color: "#991b1b",
    icon: "⚠️",
    title: "Требует уточнения",
    body: null,
  },
};

const QuestionnaireSection = () => {
  const navigate = useNavigate();
  const [q, setQ]                     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [templateUrl, setTemplateUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError]             = useState("");

  useEffect(() => {
    questionnaireService.getMine().then(setQ).catch(() => {}).finally(() => setLoading(false));
    siteSettingService.getAll().then(s => setTemplateUrl(s.questionnaire_template_url || "")).catch(() => {});
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) { setSelectedFile(file); setError(""); }
  };

  const handleSend = async () => {
    if (!selectedFile) return;
    setUploading(true); setError("");
    try {
      const res = await questionnaireService.upload(selectedFile);
      setQ(res); setSelectedFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || "Ошибка загрузки");
    } finally { setUploading(false); }
  };

  if (loading) return null;

  const status = q?.status;
  const statusCfg = Q_STATUS[status];

  const btnPrimary = { background: "#f7df00", color: "#074462", border: "none", cursor: "pointer", borderRadius: 999, minHeight: 44, padding: "0 20px", fontWeight: 800, fontSize: 14 };
  const btnOutline = { background: "transparent", border: "2px solid #074462", color: "#074462", cursor: "pointer", borderRadius: 999, minHeight: 44, padding: "0 20px", fontWeight: 700, fontSize: 14 };
  const btnGhost   = { background: "transparent", border: "1px solid #ccc", color: "#64748b", cursor: "pointer", borderRadius: 999, minHeight: 36, padding: "0 14px", fontSize: 13 };

  const UploadBlock = ({ inputId, showDownload }) => (
    <div style={{ marginTop: 16 }}>
      {selectedFile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "#374151" }}>📄 {selectedFile.name}</span>
          <button type="button" style={btnPrimary} onClick={handleSend} disabled={uploading}>
            {uploading ? "Отправляем..." : "Отправить анкету"}
          </button>
          <button type="button" style={btnGhost} disabled={uploading} onClick={() => setSelectedFile(null)}>
            Отменить
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {showDownload && templateUrl && (
            <a href={getUploadUrl(templateUrl)} download style={{ textDecoration: "none" }}>
              <button type="button" style={btnOutline}>↓ Скачать бланк</button>
            </a>
          )}
          <label style={{ display: "inline-block" }}>
            <button type="button" style={btnPrimary}
              onClick={() => document.getElementById(inputId).click()}>
              {q ? "Обновить файл анкеты" : "Выбрать файл анкеты"}
            </button>
            <input id={inputId} type="file" accept=".pdf,.doc,.docx" hidden onChange={handleFileSelect} />
          </label>
        </div>
      )}
      {error && <p style={{ color: "red", fontSize: 14, marginTop: 8 }}>{error}</p>}
    </div>
  );

  return (
    <>
      <section className="dashboard-documents">
        <span className="section-badge">Анкета</span>
        <h2>Входная анкета</h2>

        {!q ? (
          <>
            <p>
              После первичной консультации администратор направит вас на заполнение
              входной анкеты. Скачайте бланк, заполните и загрузите обратно.
            </p>
            <UploadBlock inputId="q-upload" showDownload />
          </>
        ) : (
          <>
            {statusCfg && (
              <div style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                background: statusCfg.bg, border: `1.5px solid ${statusCfg.border}`,
                borderRadius: 16, padding: "16px 20px", marginBottom: 16,
                color: statusCfg.color,
              }}>
                <span style={{ fontSize: 22, lineHeight: 1.3 }}>{statusCfg.icon}</span>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>{statusCfg.title}</strong>
                  <span style={{ fontSize: 14 }}>
                    {status === "rejected" && q.admin_note ? q.admin_note : statusCfg.body}
                  </span>
                </div>
              </div>
            )}
            {(status === "pending" || status === "rejected") && (
              <UploadBlock inputId="q-reupload" showDownload />
            )}
          </>
        )}
      </section>

      {status === "approved" && (
        <section className="dashboard-documents">
          <span className="section-badge">Документы</span>
          <h2>Подайте документы</h2>
          <p>
            Анкета одобрена — теперь загрузите пакет документов. После проверки
            администрация привяжет ребёнка к вашему аккаунту.
          </p>
          <ul>
            <li>ИППСУ</li>
            <li>Свидетельство о рождении ребёнка</li>
            <li>СНИЛС ребёнка</li>
            <li>Паспорт и СНИЛС родителя</li>
          </ul>
          <button onClick={() => navigate("/profile")}>Загрузить документы</button>
        </section>
      )}
    </>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const isAdmin   = isAdminRole(user?.role);
  const isTeacher = isTeacherRole(user?.role); // role === 'teacher', not admin
  const isUser    = !isAdmin && !isTeacher;

  const [hasChildren, setHasChildren] = useState(false);
  const [childrenLoading, setChildrenLoading] = useState(true);

  useEffect(() => {
    document.title = "Личный кабинет";
  }, []);

  useEffect(() => {
    scheduleService
      .getMyChildren()
      .then((data) => setHasChildren(data.length > 0))
      .catch(() => setHasChildren(false))
      .finally(() => setChildrenLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
      onLogout();
      toast.success("Вы успешно вышли из системы");
      navigate("/login");
    } catch (error) {
      console.error(error);
      onLogout();
      navigate("/login");
    }
  };

  const adminCards = useMemo(
    () => [
      {
        title: "Модуль расписания",
        text: "Автоматическое формирование расписания занятий.",
        button: "Открыть",
        path: "/admin/schedule",
      },
      {
        title: "Управление сайтом",
        text: "Редактирование публичных страниц и контента.",
        button: "CMS",
        path: "/admin/cms",
      },
      {
        title: "Отзывы",
        text: "Модерация отзывов пользователей.",
        button: "Открыть",
        path: "/admin/reviews",
      },
    ],
    []
  );

  const userCards = useMemo(
    () => [
      {
        title: "Отзывы",
        text: "Оставьте отзыв о работе центра.",
        button: "Написать отзыв",
        path: "/reviews",
      },
      {
        title: "Поддержать центр",
        text: "Поддержите деятельность нашего центра.",
        button: "Перейти",
        path: "/donation",
      },
    ],
    []
  );

  const subtitle = isAdmin
    ? "Здесь вы можете управлять расписанием, отзывами и контентом сайта."
    : isTeacher
    ? "Здесь вы можете просматривать своё расписание занятий."
    : hasChildren
    ? "Здесь вы можете смотреть расписание, оставить отзыв и поддержать Центр."
    : "Загрузите документы, чтобы администрация смогла привязать ребёнка к вашему аккаунту.";

  return (
    <div className="page page--dashboard">
      <Header />

      <main className="dashboard">
        <div className=" page-container">

          {/* ── Hero ── */}
          <section className="dashboard__hero">
            <div>
              <span className="section-badge">Личный кабинет</span>
              <h1 className="dashboard__title">
                Здравствуйте,&nbsp;{user?.first_name}!
              </h1>
              <p className="dashboard__subtitle">{subtitle}</p>
            </div>
            <div className="dashboard__actions">
              <button onClick={() => navigate("/profile")}>Профиль</button>
              <button className="dashboard__logout" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </section>

          {/* ── Admin layout: 3 blocks ── */}
          {isAdmin && (
            <>
              <section className="dashboard__cards">
                {adminCards.map((card) => (
                  <article key={card.title} className="dashboard-card" onClick={() => navigate(card.path)} style={{ cursor: 'pointer' }}>
                    <h2>{card.title}</h2>
                    <p>{card.text}</p>
                    <button onClick={e => { e.stopPropagation(); navigate(card.path) }}>
                      {card.button}
                    </button>
                  </article>
                ))}
              </section>

              {user?.teacher_id && <TeacherScheduleWidget user={user} />}

              {!childrenLoading && hasChildren && <ChildScheduleWidget />}
            </>
          )}

          {/* ── Teacher layout ── */}
          {!isAdmin && isTeacher && (
            <section className="dashboard__main-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <TeacherScheduleWidget user={user} />
                {!childrenLoading && hasChildren && <ChildScheduleWidget />}
              </div>
              <section className="dashboard__cards" />
            </section>
          )}

          {/* ── User (parent) layout ── */}
          {isUser && (
            <section className="dashboard__main-grid">
              {childrenLoading ? (
                <section className="dashboard-documents">
                  <div className="dashboard-schedule__empty">Проверяем данные...</div>
                </section>
              ) : hasChildren ? (
                <ChildScheduleWidget />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  <QuestionnaireSection />
                </div>
              )}

              <section className="dashboard__cards">
                {userCards.map((card) => (
                  <article key={card.title} className="dashboard-card">
                    <h2>{card.title}</h2>
                    <p>{card.text}</p>
                    <button onClick={() => navigate(card.path)}>
                      {card.button}
                    </button>
                  </article>
                ))}
              </section>
            </section>
          )}

          {/* ── News ── */}
          <section className="dashboard-news">
            <NewsSection limit={3} />
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
