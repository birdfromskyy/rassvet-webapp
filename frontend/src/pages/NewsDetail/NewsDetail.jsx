import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import NewsCard from "../../components/NewsCard/NewsCard";

import newsService from "../../services/newsService";
import { getUploadUrl } from "../../services/cmsService";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

import "./NewsDetail.scss";

const NewsDetail = () => {
  const { slug } = useParams();

  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    document.title = "РАСсвет | Новость";
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchArticle();
    }
  }, [slug]);

  useEffect(() => {
    return () => {
      hasLoadedRef.current = false;
    };
  }, [slug]);

  const fetchArticle = async () => {
    setLoading(true);

    try {
      const data = await newsService.getArticleBySlug(slug);

      setArticle(data);

      const related = await newsService.getRelatedArticles(slug, 3);

      setRelatedArticles(related || []);
    } catch (error) {
      console.error(error);
      setError("Не удалось загрузить статью");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCategoryLabel = (category) => {
    const labels = {
      news: "Новости",
      articles: "Статьи",
      updates: "Обновления",
      events: "События",
    };

    return labels[category] || category;
  };

  const getVkEmbedUrl = (url) => {
    if (!url) return null;

    if (url.includes("video_ext.php")) return url;

    const videoMatch = url.match(/video-?(\d+)_(\d+)/);
    if (videoMatch) {
      return `https://vk.com/video_ext.php?oid=-${videoMatch[1]}&id=${videoMatch[2]}&hd=2`;
    }

    // ВК Клипы: vk.com/clip-123456_789012 или vk.com/clips/...?z=clip-123456_789012
    const clipMatch = url.match(/clip-?(\d+)_(\d+)/);
    if (clipMatch) {
      return `https://vk.com/video_ext.php?oid=-${clipMatch[1]}&id=${clipMatch[2]}&hd=2`;
    }

    return null;
  };

  const getUrlBasename = (url) => {
    try {
      return decodeURIComponent(url.split("/").pop().split("?")[0]) || null;
    } catch {
      return null;
    }
  };

  const safeUrl = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:"
        ? url
        : null;
    } catch {
      return null;
    }
  };

  const renderBlock = (block, index) => {
    if (!block?.type) return null;

    switch (block.type) {
      case "text":
        return (
          <div key={block.id || index} className="article-block">
            {block.content
              .split("\n")
              .filter((p) => p.trim())
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </div>
        );

      case "image": {
        const imageUrl = getUploadUrl(block.content);

        if (!imageUrl) return null;

        return (
          <div key={block.id || index} className="article-block">
            <img
              src={imageUrl}
              alt="Изображение"
              className="article-block__image"
            />
          </div>
        );
      }

      case "video": {
        const embedUrl = getVkEmbedUrl(block.content);

        if (!embedUrl) {
          const videoHref = safeUrl(block.content);
          if (!videoHref) return null;
          return (
            <div key={block.id || index} className="article-file">
              <a href={videoHref} target="_blank" rel="noopener noreferrer">
                Открыть видео
              </a>
            </div>
          );
        }

        return (
          <div key={block.id || index} className="article-video">
            <iframe
              src={embedUrl}
              title="Видео"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      case "file": {
        const fileUrl = getUploadUrl(block.content);

        if (!fileUrl) return null;

        return (
          <div key={block.id || index} className="article-file">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              {block.title || getUrlBasename(block.content) || "Скачать файл"}
            </a>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <main className="news-detail-page">
        <div className="news-detail__container">
          <div className="news-detail__state">
            <h2>Загрузка статьи...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (error || !article) {
    return (
      <main className="news-detail-page">
        <div className="news-detail__container">
          <div className="news-detail__state news-detail__state--error">
            <h2>{error || "Статья не найдена"}</h2>

            <button onClick={() => navigate("/news")}>
              Вернуться к новостям
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="news-detail-page">
        <div className="news-detail__container container">
          <div className="news-detail__layout">
            <article className="news-detail">
              <button
                className="news-detail__back"
                onClick={() => navigate("/news")}
              >
                ← Все новости
              </button>

              <h1 className="news-detail__title">{article.title}</h1>

              {article.summary && (
                <p className="news-detail__summary">{article.summary}</p>
              )}

              <div className="news-detail__meta">
                <span>
                  {formatDate(article.published_at || article.date_created)}
                </span>
              </div>

              {getUploadUrl(article.featured_image) && (
                <img
                  src={getUploadUrl(article.featured_image)}
                  alt={article.title}
                  className="news-detail__cover"
                />
              )}

              <div className="news-detail__content">
                {article.blocks?.map((block, index) =>
                  renderBlock(block, index),
                )}
              </div>

            </article>

            {/* {relatedArticles.length > 0 && (
              <aside className="news-detail-sidebar">
                <div className="news-detail-sidebar__card">
                  <h2>📖 Похожие статьи</h2>

                  {relatedArticles.map((article) => (
                    <NewsCard
                      key={article.id}
                      article={article}
                      variant="compact"
                    />
                  ))}
                </div>
              </aside>
            )} */}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NewsDetail;
