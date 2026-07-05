import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./SupportList.scss";
import supportService, {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
} from "../../services/supportService";

/* Support list page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & behaviour: my tickets from supportService.listMyTickets().
   Uses its own scoped styles (SupportList.scss) so the shared
   Support.scss for the ticket/new pages is untouched. */

export default function SupportList() {
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useBrandFont();

  useEffect(() => {
    document.title = "РАСсвет | Техподдержка";
    supportService
      .listMyTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useReveal(rootRef, [tickets.length, loading]);

  return (
    <div className="support-list-page" ref={rootRef}>
      <Header />

      <section className="sup-hero">
        <div className="sup-hero__glow" aria-hidden="true" />
        <div className="page-container sup-hero__inner">
          <div>
            <span className="d2-tag">Техподдержка</span>
            <h1 className="sup-hero__title">Мои обращения</h1>
            <p className="sup-hero__text">
              Здесь находятся все ваши обращения в службу поддержки центра
              «РАСсвет».
            </p>
          </div>
          <button
            type="button"
            className="d2-btn d2-btn--yellow"
            onClick={() => navigate("/support/new")}
          >
            + Новое обращение
          </button>
        </div>
      </section>

      <main className="sup-body">
        <div className="page-container">
          {loading ? (
            <p className="d2-empty">Загрузка...</p>
          ) : tickets.length === 0 ? (
            <div className="sup-empty" data-reveal>
              <p>У вас пока нет обращений.</p>
              <button
                type="button"
                className="d2-btn d2-btn--ink"
                onClick={() => navigate("/support/new")}
              >
                Создать первое обращение
              </button>
            </div>
          ) : (
            <div className="sup-list" data-reveal>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="sup-item"
                  onClick={() => navigate(`/support/${t.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/support/${t.id}`)}
                >
                  <div className="sup-item__body">
                    <p className="sup-item__subject">{t.subject}</p>
                    <div className="sup-item__meta">
                      <span className="sup-item__cat">
                        {SUPPORT_CATEGORY_LABEL[t.category] || t.category}
                      </span>
                      <span className="sup-item__date">
                        {new Date(t.updated_at).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <span className={`sup-status sup-status--${t.status}`}>
                    {SUPPORT_STATUS_LABEL[t.status] || t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
