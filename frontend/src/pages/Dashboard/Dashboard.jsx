import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import NewsSection from "../../components/NewsSection/NewsSection";

import authService from "../../services/authService";
import scheduleService from "../../services/scheduleService";

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

const TodayScheduleWidget = ({ user }) => {
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";

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
        if (isTeacher) {
          const options = await scheduleService.getTeacherScheduleOptions();

          const fullName = [
            user?.last_name,
            user?.first_name,
            user?.middle_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const ownTeacher = options.teachers?.find(
            (t) => t.full_name?.toLowerCase() === fullName
          );

          const data = await scheduleService.getTeacherPublishedSchedule(
            weekStartISO,
            {
              teacher_id: ownTeacher?.id || "",
              student_id: "",
            }
          );

          setSlots(
            (data.slots || []).filter((slot) => slot.weekday === todayWeekday)
          );
        } else {
          const childrenData = await scheduleService.getMyChildren();
          setChildren(childrenData);

          if (childrenData.length > 0) {
            const data = await scheduleService.getChildSchedule(
              childrenData[0].student_id,
              weekStartISO
            );

            setSlots(
              (data.slots || []).filter(
                (slot) => slot.weekday === todayWeekday
              )
            );
          }
        }
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isTeacher, user, weekStartISO, todayWeekday]);

  useEffect(() => {
    if (isTeacher || !activeChild) return;

    const loadChildSchedule = async () => {
      setLoading(true);

      try {
        const data = await scheduleService.getChildSchedule(
          activeChild.student_id,
          weekStartISO
        );

        setSlots(
          (data.slots || []).filter((slot) => slot.weekday === todayWeekday)
        );
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadChildSchedule();
  }, [activeChildIndex, activeChild, isTeacher, weekStartISO, todayWeekday]);

  const prevChild = () => {
    setActiveChildIndex((prev) =>
      prev === 0 ? children.length - 1 : prev - 1
    );
  };

  const nextChild = () => {
    setActiveChildIndex((prev) =>
      prev === children.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <section className="dashboard-schedule">
      <div className="dashboard-schedule__top">
        <div>
          <span className="section-badge">Сегодня</span>

          <h2>{isTeacher ? "Ваше расписание" : "Расписание ребёнка"}</h2>
        </div>

        <button onClick={() => navigate("/my-schedule")}>
          Посмотреть всё расписание
        </button>
      </div>

      {loading ? (
        <div className="dashboard-schedule__empty">Загружаем расписание...</div>
      ) : slots.length === 0 ? (
        <div className="dashboard-schedule__empty">На сегодня занятий нет</div>
      ) : (
        <div className="dashboard-schedule__list">
          {slots.map((slot) => (
            <article className="dashboard-schedule__item" key={slot.id}>
              <div className="dashboard-schedule__time">
                {slot.start_time}–{slot.end_time}
              </div>

              <div>
                <h3>{getSlotSubject(slot)}</h3>
                <p>
                  {slot.room_name || slot.room?.name || "Кабинет не указан"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
            {!isTeacher && children.length > 1 && (
        <div className="dashboard-schedule__switcher">
          <button onClick={prevChild}>←</button>
          <span>
            {activeChild.student?.full_name}
          </span>
          <button onClick={nextChild}>→</button>
        </div>
      )}
    </section>
  );
};

const UploadDocumentsWidget = () => {
  const navigate = useNavigate();

  return (
    <section className="dashboard-documents">
      <span className="section-badge">Документы</span>

      <h2>Загрузите документы</h2>

      <p>
        Чтобы получить доступ к расписанию и услугам Центра, загрузите
        необходимые документы. После проверки администрация привяжет ребёнка к
        вашему аккаунту.
      </p>

      <p>
        Если вы ещё не проходили консультацию —{" "}
        <Link to="/service-algorithm">ознакомьтесь с алгоритмом получения услуг</Link>.
      </p>

      <ul>
        <li>ИППСУ</li>
        <li>Свидетельство о рождении ребёнка</li>
        <li>СНИЛС ребёнка</li>
        <li>Паспорт и СНИЛС родителя</li>
      </ul>

      <button onClick={() => navigate("/profile")}>Загрузить документы</button>
    </section>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isUser = !isAdmin && !isTeacher;

  const [hasChildren, setHasChildren] = useState(false);
  const [childrenLoading, setChildrenLoading] = useState(isUser);

  useEffect(() => {
    document.title = "РАСсвет | Личный кабинет";
  }, []);

  useEffect(() => {
    if (!isUser) return;

    scheduleService
      .getMyChildren()
      .then((data) => setHasChildren(data.length > 0))
      .catch(() => setHasChildren(false))
      .finally(() => setChildrenLoading(false));
  }, [isUser]);

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

  const cards = useMemo(
    () => [
      {
        title: "Отзывы",
        text: "Оставьте отзыв о работе центра.",
        button: "Написать отзыв",
        path: "/reviews",
        show: isUser,
      },
      {
        title: "Поддержать центр",
        text: "Раздел временно недоступен.",
        button: "Недоступно",
        path: "#",
        show: isUser,
        disabled: true,
      },
      {
        title: "Составление расписания",
        text: "Автоматическое формирование расписания занятий.",
        button: "Открыть",
        path: "/admin/schedule",
        show: isAdmin,
      },
      {
        title: "Управление сайтом",
        text: "Редактирование публичных страниц и контента.",
        button: "CMS",
        path: "/admin/cms",
        show: isAdmin,
      },
      {
        title: "Отзывы",
        text: "Модерация отзывов пользователей.",
        button: "Открыть",
        path: "/admin/reviews",
        show: isAdmin,
      },
    ],
    [isAdmin, isUser]
  );

  return (
    <div className="page page--dashboard">
      <Header />

      <main className="dashboard">
        <div className="dashboard__container container">
          <section className="dashboard__hero">
            <div>
              <span className="section-badge">Личный кабинет</span>

              <h1 className="dashboard__title">
                Здравствуйте,&nbsp;{user?.first_name}!
              </h1>

              <p className="dashboard__subtitle">
                {isAdmin
                  ? "Здесь вы можете управлять расписанием, отзывами и контентом сайта."
                  : isTeacher
                  ? "Здесь вы можете просматривать своё расписание занятий."
                  : hasChildren
                  ? "Здесь вы можете смотреть расписание, оставить отзыв и поддержать Центр."
                  : "Загрузите документы, чтобы администрация смогла привязать ребёнка к вашему аккаунту."}
              </p>
            </div>

            <div className="dashboard__actions">
              <button onClick={() => navigate("/profile")}>Профиль</button>

              <button className="dashboard__logout" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </section>

          {!isAdmin ? (
            <section className="dashboard__main-grid">
              {isTeacher ? (
                <TodayScheduleWidget user={user} />
              ) : childrenLoading ? (
                <section className="dashboard-documents">
                  <div className="dashboard-schedule__empty">
                    Проверяем данные...
                  </div>
                </section>
              ) : hasChildren ? (
                <TodayScheduleWidget user={user} />
              ) : (
                <UploadDocumentsWidget />
              )}

              <section className="dashboard__cards">
                {cards
                  .filter((card) => card.show)
                  .map((card) => (
                    <article key={card.title} className="dashboard-card">
                      <h2>{card.title}</h2>

                      <p>{card.text}</p>

                      <button
                        disabled={card.disabled}
                        onClick={() => {
                          if (!card.disabled) navigate(card.path);
                        }}
                      >
                        {card.button}
                      </button>
                    </article>
                  ))}
              </section>
            </section>
          ) : (
            <section className="dashboard__cards">
              {cards
                .filter((card) => card.show)
                .map((card) => (
                  <article key={card.title} className="dashboard-card">
                    <h2>{card.title}</h2>

                    <p>{card.text}</p>

                    <button
                      disabled={card.disabled}
                      onClick={() => {
                        if (!card.disabled) navigate(card.path);
                      }}
                    >
                      {card.button}
                    </button>
                  </article>
                ))}
            </section>
          )}

          <section className="dashboard-news">
            <NewsSection limit={3} />
          </section>

          {/* <section className="dashboard-profile">
            <div className="dashboard-profile__top">
              <span className="section-badge">Профиль</span>

              <h2>Информация о пользователе</h2>
            </div>

            <div className="dashboard-profile__grid">
              <div className="dashboard-profile__item">
                <span>ФИО</span>

                <strong>
                  {user?.last_name} {user?.first_name} {user?.middle_name}
                </strong>
              </div>

              <div className="dashboard-profile__item">
                <span>Email</span>

                <strong>{user?.email}</strong>
              </div>

              <div className="dashboard-profile__item">
                <span>Роль</span>

                <strong>
                  {isAdmin
                    ? "Администратор"
                    : isTeacher
                    ? "Преподаватель"
                    : "Пользователь"}
                </strong>
              </div>
            </div>
          </section> */}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;