import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import NewsArticleView from "../../components/NewsArticleView/NewsArticleView";
import useBrandFont from "../../hooks/useBrandFont";
import newsService from "../../services/newsService";
import "./NewsDetail.scss";

function NewsDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useBrandFont();

  useEffect(() => { document.title = "РАСсвет | Новость"; }, []);
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);
    newsService.getArticleBySlug(slug)
      .then((data) => { if (isCurrent) setArticle(data); })
      .catch(() => { if (isCurrent) setError("Не удалось загрузить статью"); })
      .finally(() => { if (isCurrent) setLoading(false); });
    return () => { isCurrent = false; };
  }, [slug]);

  return (
    <div className="news-detail-page">
      <Header />
      {loading ? <div className="nd-state"><p className="d2-empty">Загрузка статьи...</p></div> : error || !article ? <div className="nd-state"><p className="d2-empty">{error || "Статья не найдена"}</p><button type="button" className="d2-btn d2-btn--ink" onClick={() => navigate("/news")}>Вернуться к новостям</button></div> : <NewsArticleView article={article} onBack={() => navigate("/news")} />}
      <Footer />
    </div>
  );
}

export default NewsDetail;
