import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import questionnaireService from "../../services/questionnaireService";
import "./ServiceAlgorithm.scss";

// Read current user from localStorage (set by App.js on login)
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

function ServiceAlgorithm() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isRegularUser = user?.role === "user";

  const [qStatus, setQStatus]   = useState(null);   // null | "pending" | "approved" | "rejected"
  const [qLoading, setQLoading] = useState(isRegularUser);

  useEffect(() => {
    document.title = "Алгоритм получения услуг";
    if (!isRegularUser) { setQLoading(false); return; }
    questionnaireService.getMine()
      .then(q => setQStatus(q?.status || null))
      .catch(() => {})
      .finally(() => setQLoading(false));
  }, [isRegularUser]);

  // ── Step 02 — Анкета ────────────────────────────────────────────────────────
  const Step02Action = () => {
    if (!user) {
      return (
        <Link to="/dashboard" className="algo-btn">
          Войти и заполнить анкету
        </Link>
      );
    }
    if (qLoading) return null;

    if (qStatus === "approved") {
      return (
        <span className="algo-badge algo-badge--done">
          ✅ Анкета принята
        </span>
      );
    }
    if (qStatus === "pending") {
      return (
        <span className="algo-badge algo-badge--wait">
          ⏳ Анкета на проверке
        </span>
      );
    }
    if (qStatus === "rejected") {
      return (
        <>
          <span className="algo-badge algo-badge--warn">⚠️ Требует уточнения</span>
          <button className="algo-btn algo-btn--sm" onClick={() => navigate("/dashboard")}>
            Переотправить анкету
          </button>
        </>
      );
    }
    // not submitted yet
    return (
      <button className="algo-btn" onClick={() => navigate("/dashboard")}>
        Перейти к анкете
      </button>
    );
  };

  // ── Step 04 — Документы ─────────────────────────────────────────────────────
  const Step04Action = () => {
    if (!user) {
      return (
        <button className="algo-btn algo-btn--locked" disabled>
          🔒 Сначала пройдите анкетирование
        </button>
      );
    }
    if (qLoading) return null;

    if (qStatus === "approved") {
      return (
        <button className="algo-btn" onClick={() => navigate("/profile")}>
          Подать документы →
        </button>
      );
    }
    return (
      <button className="algo-btn algo-btn--locked" disabled>
        🔒 Доступно после одобрения анкеты
      </button>
    );
  };

  return (
    <>
      <Header />

      <main className="serviceAlgorithm">
        <section className="serviceAlgorithm__hero">
          <div className="container serviceAlgorithm__hero-inner">
            <div>
              <span className="section-badge">Получение услуг</span>
              <h1>Алгоритм получения услуг</h1>
              <p>
                Пошаговая инструкция для родителей: как оформить документы,
                согласовать услуги и начать занятия в Центре «РАСсвет».
              </p>
            </div>
          </div>
        </section>

        <section className="serviceAlgorithm__steps">
          <div className="container">
            <div className="serviceAlgorithm__grid">

              {/* 01 */}
              <article className="algorithmCard">
                <span>01</span>
                <h3>Свяжитесь с нами</h3>
                <p>
                  Позвоните по номеру +7 (900) 397-34-59 — мы ответим на все
                  вопросы и проведём первичную консультацию удалённо, в удобное
                  для вас время.
                </p>
                <div className="algorithmCard__action">
                  <Link to="/consultation-request" className="algo-btn algo-btn--outline">
                    Оставить заявку
                  </Link>
                </div>
              </article>

              {/* 02 */}
              <article className={`algorithmCard${qStatus === "approved" ? " algorithmCard--done" : ""}`}>
                <span>02</span>
                <h3>Заполните анкету</h3>
                <p>
                  Мы пришлём анкету с вопросами о ребёнке. На её основе
                  специалисты подберут оптимальный состав занятий и запишут вас.
                </p>
                <div className="algorithmCard__action">
                  <Step02Action />
                </div>
              </article>

              {/* 03 */}
              <article className="algorithmCard">
                <span>03</span>
                <h3>Мы свяжемся с вами</h3>
                <p>
                  Как только центр будет готов принять вашего ребёнка, мы
                  позвоним и согласуем удобное время для начала занятий.
                </p>
              </article>

              {/* 04 */}
              <article className={`algorithmCard${qStatus === "approved" ? " algorithmCard--active" : " algorithmCard--locked"}`}>
                <span>04</span>
                <h3>Подготовьте документы</h3>
                <p>
                  Понадобятся: ИППСУ, свидетельство о рождении и СНИЛС ребёнка,
                  паспорт и СНИЛС родителя или законного представителя.
                </p>
                <div className="algorithmCard__action">
                  <Step04Action />
                </div>
              </article>

              {/* 05 */}
              <article className="algorithmCard">
                <span>05</span>
                <h3>Заключите договор</h3>
                <p>
                  После проверки документов администрация оформит договор на
                  предоставление социальных услуг.
                </p>
              </article>

              {/* 06 */}
              <article className="algorithmCard">
                <span>06</span>
                <h3>Начните занятия</h3>
                <p>
                  Специалисты подберут оптимальное расписание — и ребёнок может
                  приступать к занятиям.
                </p>
              </article>

            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default ServiceAlgorithm;
