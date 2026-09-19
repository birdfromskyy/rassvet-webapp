import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { toast } from "react-toastify";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import NewsArticleView from "../components/NewsArticleView/NewsArticleView";
import newsService from "../services/newsService";
import "./NewsDetail/NewsDetail.scss";

const AdminNewsPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    newsService.getArticleById(id)
      .then((data) => setArticle(data.article || data))
      .catch(() => toast.error("Не удалось загрузить статью"))
      .finally(() => setLoading(false));
  }, [id]);

  const publish = async () => {
    setPublishing(true);
    try {
      const updated = await newsService.setPublicationStatus(article.id, "published");
      setArticle(updated);
      toast.success("Статья опубликована");
    } catch {
      toast.error("Ошибка публикации");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="news-detail-page admin-news-preview">
      <div className="admin-news-preview__bar">
        <div className="admin-news-preview__bar-inner">
          <button type="button" onClick={() => navigate("/admin/cms/news")}>← К управлению новостями</button>
          <span>Предпросмотр</span>
          {article && <strong className={article.status === "published" ? "is-published" : ""}>{article.status === "published" ? "Опубликована" : "Черновик"}</strong>}
          {article?.status === "draft" && <button type="button" className="admin-news-preview__publish" onClick={publish} disabled={publishing}>{publishing ? "Публикуем…" : "Опубликовать"}</button>}
        </div>
      </div>
      <Header />
      {loading ? <div className="nd-state"><CircularProgress sx={{ color: "#074462" }} /></div> : article ? <NewsArticleView article={article} onBack={() => navigate("/admin/cms/news")} backLabel="← К управлению новостями" /> : <div className="nd-state"><p className="d2-empty">Статья не найдена</p></div>}
      <Footer />
    </div>
  );
};

export default AdminNewsPreview;
