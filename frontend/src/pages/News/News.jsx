import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import NewsCard from "../../components/NewsCard/NewsCard";
import newsService from "../../services/newsService";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import "./News.scss";

/* News list page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & behaviour: paginated + searchable published articles. */

const getPageFromParams = (value) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const News = () => {
  const rootRef = useRef(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const page = getPageFromParams(searchParams.get("page"));
  const search = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(search);

  const updateParams = useCallback((updates, options) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, options);
  }, [setSearchParams]);

  useEffect(() => {
    document.title = "Новости";
  }, []);

  useBrandFont();

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);

    newsService
      .getPublishedArticles({ page, limit: 8, ...(search && { search }) })
      .then((data) => {
        if (!isCurrent) return;
        const pages = Math.max(1, data.pagination?.pages || 1);
        if (page > pages) {
          updateParams({ page: pages === 1 ? undefined : pages }, { replace: true });
          return;
        }
        setArticles(data.articles || []);
        setTotalPages(pages);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error(err);
        setError("Не удалось загрузить новости");
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => { isCurrent = false; };
  }, [page, search, updateParams]);

  useReveal(rootRef, [articles.length, loading]);

  /* Live search: debounce keystrokes, then filter. The hero is compact,
     so results are already visible below — no scrolling needed. */
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const normalizedSearch = searchInput.trim();
    if (normalizedSearch === search) return undefined;
    const t = setTimeout(() => {
      updateParams({ search: normalizedSearch || undefined, page: undefined }, { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, search, updateParams]);

  const handlePageChange = (nextPage) => {
    if (nextPage === page) return;
    updateParams({ page: nextPage === 1 ? undefined : nextPage });
    rootRef.current?.querySelector("#np-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="news-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Новости центра</span>
            <h1 className="d2-hero__title">
              Новости, события и полезные материалы
            </h1>
            <p className="d2-hero__text">
              Следите за жизнью центра «РАСсвет», мероприятиями, обновлениями и
              важной информацией.
            </p>

            <div className="np-search">
              <div className="np-search__field">
                <span className="np-search__icon" aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="text"
                  placeholder="Поиск по новостям..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="np-search__clear"
                    onClick={() => setSearchInput("")}
                    aria-label="Очистить поиск"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto np-section" id="np-results">
        <div className="page-container">
          {loading ? (
            <p className="d2-empty">Загрузка...</p>
          ) : error ? (
            <p className="d2-empty">{error}</p>
          ) : articles.length === 0 ? (
            <p className="d2-empty">Новостей пока нет. Материалы появятся позже.</p>
          ) : (
            <>
              <div className="np-grid">
                {articles.map((article) => (
                  <div className="np-cell" key={article.id} data-reveal>
                    <NewsCard article={article} returnTo={`${location.pathname}${location.search}`} />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="np-pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={page === i + 1 ? "is-active" : ""}
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default News;
