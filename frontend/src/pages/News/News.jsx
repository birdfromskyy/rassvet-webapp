import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NewsCard from "../../components/NewsCard/NewsCard";
import newsService from "../../services/newsService";
import "./News.scss";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const News = () => {
  const navigate = useNavigate();

  const [articles, setArticles] = useState([]);
  const [popularArticles, setPopularArticles] = useState([]);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    document.title = "Новости";
  }, []);

  useEffect(() => {
    fetchPopularArticles();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [page, search]);

  const fetchArticles = async () => {
    setLoading(true);

    try {
      const params = {
        page,
        limit: 9,
        ...(search && { search }),
      };

      const data = await newsService.getPublishedArticles(params);

      setArticles(data.articles || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error(error);
      setError("Не удалось загрузить новости");
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularArticles = async () => {
    try {
      const data = await newsService.getPopularArticles(5);
      setPopularArticles(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };


  return (
    <>
      <Header />
      <main className="news-page">
        <section className="news">
          <div className="page-container">
            <div className="news__hero">
              <div>
                <span className="section-badge">Новости центра</span>

                <h1 className="news__title">
                  Новости, события и полезные материалы
                </h1>

                <p className="news__subtitle">
                  Следите за жизнью центра «РАСсвет», мероприятиями,
                  обновлениями и важной информацией.
                </p>
              </div>
            </div>

            <form className="news__filters" onSubmit={handleSearch}>
              <div className="news__search">
                <input
                  type="text"
                  placeholder="Поиск по новостям..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />

                {searchInput && (
                  <button
                    type="button"
                    className="news__clear"
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Очистить поиск"
                  >
                    ×
                  </button>
                )}
              </div>

              <button type="submit" className="btn btn--secondary">
                Искать
              </button>
            </form>

            <div className="news__layout">
              <div className="news__main">
                {loading ? (
                  <div className="news__state">
                    <h3>Загрузка...</h3>
                  </div>
                ) : error ? (
                  <div className="news__state news__state--error">
                    <h3>{error}</h3>
                  </div>
                ) : articles.length === 0 ? (
                  <div className="news__state">
                    <h3>Новостей пока нет</h3>
                    <p>Материалы появятся позже.</p>
                  </div>
                ) : (
                  <>
                    <div className="news__grid">
                      {articles.map((article) => (
                        <NewsCard key={article.id} article={article} />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="news__pagination">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <button
                            key={i}
                            className={page === i + 1 ? "is-active" : ""}
                            onClick={() => setPage(i + 1)}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default News;
