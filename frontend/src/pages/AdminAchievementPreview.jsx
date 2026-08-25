import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import NewsArticleView from "../components/NewsArticleView/NewsArticleView";
import achievementService from "../services/achievementService";
import "./NewsDetail/NewsDetail.scss";

function AdminAchievementPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    achievementService.adminGetById(id).then(setStory).catch(() => setStory(null)).finally(() => setLoading(false));
  }, [id]);

  const article = story ? { title: story.child_name, blocks: story.blocks || [] } : null;

  return (
    <div className="news-detail-page admin-news-preview">
      <div className="admin-news-preview__bar">
        <div className="admin-news-preview__bar-inner">
          <button type="button" onClick={() => navigate("/admin/cms/achievements")}>← К историям успеха</button>
          <span>Предпросмотр</span>
          {story && <strong className={story.is_visible ? "is-published" : ""}>{story.is_visible ? "Опубликована" : "Скрыта"}</strong>}
        </div>
      </div>
      <Header />
      {loading ? <div className="nd-state"><CircularProgress sx={{ color: "#074462" }} /></div> : article ? (
        <NewsArticleView article={article} eyebrow="История успеха" conclusion={story.conclusion} showDate={false} onBack={() => navigate("/admin/cms/achievements")} backLabel="← К историям успеха" />
      ) : <div className="nd-state"><p className="d2-empty">История не найдена</p></div>}
      <Footer />
    </div>
  );
}

export default AdminAchievementPreview;
