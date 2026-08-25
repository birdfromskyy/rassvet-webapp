import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import NewsArticleView from "../../components/NewsArticleView/NewsArticleView";
import achievementService from "../../services/achievementService";
import useBrandFont from "../../hooks/useBrandFont";
import "../NewsDetail/NewsDetail.scss";

function AchievementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useBrandFont();

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError("");
    achievementService
      .getPublicById(id)
      .then((data) => {
        if (!isCurrent) return;
        setStory(data);
        document.title = `${data.child_name} — история успеха`;
      })
      .catch(() => {
        if (isCurrent) setError("История не найдена");
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => { isCurrent = false; };
  }, [id]);

  const article = story ? {
    title: story.child_name,
    blocks: story.blocks || [],
  } : null;

  return (
    <div className="news-detail-page achievement-detail-page">
      <Header />
      {loading ? (
        <div className="nd-state"><p className="d2-empty">Загрузка истории...</p></div>
      ) : error || !article ? (
        <div className="nd-state">
          <p className="d2-empty">{error || "История не найдена"}</p>
          <button type="button" className="d2-btn d2-btn--ink" onClick={() => navigate("/achievements")}>Вернуться к историям</button>
        </div>
      ) : (
        <NewsArticleView
          article={article}
          eyebrow="История успеха"
          conclusion={story.conclusion}
          showDate={false}
          onBack={() => navigate("/achievements")}
          backLabel="← Все истории"
        />
      )}
      <Footer />
    </div>
  );
}

export default AchievementDetail;
