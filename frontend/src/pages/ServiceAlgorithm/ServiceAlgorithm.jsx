import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isRegularUser } from "../../utils/roles";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import questionnaireService from "../../services/questionnaireService";
import { useAuth } from "../../contexts/AuthContext";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import usePageMeta from "../../hooks/usePageMeta";
import "./ServiceAlgorithm.scss";

/* Service algorithm page — "Rassvet 2.0" design (Skills/Design2.md).
   All the interactive logic (auth + questionnaire status gating for
   steps 02 and 04) is preserved unchanged. */

function ServiceAlgorithm() {
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const showQuestionnaire = isRegularUser(user?.role);

  const [qStatus, setQStatus] = useState(null); // null | pending | approved | rejected
  const [qLoading, setQLoading] = useState(showQuestionnaire);

  useBrandFont();
  usePageMeta(
    "Алгоритм получения услуг — РАСсвет",
    "Как получить услуги центра «РАСсвет»: пошаговый алгоритм от заявки и анкеты до заключения договора и составления индивидуального расписания занятий.",
  );

  useEffect(() => {
    if (!showQuestionnaire) {
      setQLoading(false);
      return;
    }
    questionnaireService
      .getMine()
      .then((q) => setQStatus(q?.status || null))
      .catch(() => {})
      .finally(() => setQLoading(false));
  }, [showQuestionnaire]);

  useReveal(rootRef, [qLoading, qStatus]);

  // ── Step 02 — questionnaire ──────────────────────────────────
  const Step02Action = () => {
    if (!user) {
      return (
        <Link to="/dashboard" className="d2-btn d2-btn--ink algo-btn">
          Войти и заполнить анкету
        </Link>
      );
    }
    if (qLoading) return null;
    if (qStatus === "approved") {
      return <span className="algo-badge algo-badge--done">✅ Анкета принята</span>;
    }
    if (qStatus === "pending") {
      return <span className="algo-badge algo-badge--wait">⏳ Анкета на проверке</span>;
    }
    if (qStatus === "rejected") {
      return (
        <>
          <span className="algo-badge algo-badge--warn">⚠️ Требует уточнения</span>
          <button
            type="button"
            className="d2-btn d2-btn--ink algo-btn"
            onClick={() => navigate("/dashboard")}
          >
            Переотправить анкету
          </button>
        </>
      );
    }
    return (
      <button
        type="button"
        className="d2-btn d2-btn--ink algo-btn"
        onClick={() => navigate("/dashboard")}
      >
        Перейти к анкете
      </button>
    );
  };

  // ── Step 04 — documents ──────────────────────────────────────
  const Step04Action = () => {
    if (!user) {
      return (
        <button type="button" className="algo-btn algo-btn--locked" disabled>
          🔒 Сначала пройдите анкетирование
        </button>
      );
    }
    if (qLoading) return null;
    if (qStatus === "approved") {
      return (
        <button
          type="button"
          className="d2-btn d2-btn--ink algo-btn"
          onClick={() => navigate("/profile")}
        >
          Подать документы →
        </button>
      );
    }
    return (
      <button type="button" className="algo-btn algo-btn--locked" disabled>
        🔒 Доступно после одобрения анкеты
      </button>
    );
  };

  const steps = [
    {
      n: "01",
      title: "Свяжитесь с нами",
      text: "Позвоните по номеру +7 (900) 397-34-59 — мы ответим на все вопросы и проведём первичную консультацию удалённо, в удобное для вас время.",
      action: (
        <Link to="/consultation-request" className="d2-btn d2-btn--yellow algo-btn">
          Оставить заявку
        </Link>
      ),
    },
    {
      n: "02",
      title: "Заполните анкету",
      text: "Мы пришлём анкету с вопросами о ребёнке. На её основе специалисты подберут оптимальный состав занятий и запишут вас.",
      action: <Step02Action />,
      state: qStatus === "approved" ? "done" : "",
    },
    {
      n: "03",
      title: "Мы свяжемся с вами",
      text: "Как только центр будет готов принять вашего ребёнка, мы позвоним и согласуем удобное время для начала занятий.",
    },
    {
      n: "04",
      title: "Подготовьте документы",
      text: "Понадобятся: ИППСУ, свидетельство о рождении и СНИЛС ребёнка, паспорт и СНИЛС родителя или законного представителя.",
      action: <Step04Action />,
      state: qStatus === "approved" ? "active" : "locked",
    },
    {
      n: "05",
      title: "Заключите договор",
      text: "После проверки документов администрация оформит договор на предоставление социальных услуг.",
    },
    {
      n: "06",
      title: "Начните занятия",
      text: "Специалисты подберут оптимальное расписание — и ребёнок может приступать к занятиям.",
    },
  ];

  return (
    <div className="algo-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Получение услуг</span>
            <h1 className="d2-hero__title">Алгоритм получения услуг</h1>
            <p className="d2-hero__text">
              Пошаговая инструкция для родителей: как оформить документы,
              согласовать услуги и начать занятия в Центре «РАСсвет».
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto algo-section">
        <div className="page-container">
          <div className="d2-head" data-reveal>
            <span className="d2-tag d2-tag--dark">6 шагов</span>
            <h2 className="d2-h2">Путь от заявки до занятий</h2>
          </div>

          <ol className="algo-steps">
            {steps.map((step) => (
              <li
                className={`algo-step${step.state ? ` algo-step--${step.state}` : ""}`}
                key={step.n}
                data-reveal
              >
                <div className="algo-step__num">{step.n}</div>
                <div className="algo-step__card">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  {step.action && (
                    <div className="algo-step__action">{step.action}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ServiceAlgorithm;
