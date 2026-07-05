import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import newsService from "../../services/newsService";
import { getUploadUrl } from "../../services/cmsService";

import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import useBrandFont from "../../hooks/useBrandFont";

import "./NewsDetail.scss";

/* News detail page — "Rassvet 2.0" design (Skills/Design2.md).
   Block rendering (text / image / video / file) is unchanged. */

const NewsDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const hasLoadedRef = useRef(false);

  useBrandFont();

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    document.title = "РАСсвет | Новость";
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchArticle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить статью");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getVkEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes("video_ext.php")) return url;
    const videoMatch = url.match(/video-?(\d+)_(\d+)/);
    if (videoMatch) {
      return `https://vk.com/video_ext.php?oid=-${videoMatch[1]}&id=${videoMatch[2]}&hd=2`;
    }
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
          <div key={block.id || index} className="nd-block">
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
          <div key={block.id || index} className="nd-block">
            <button
              type="button"
              className="nd-img-btn"
              onClick={() => setLightbox(imageUrl)}
              title="Нажмите, чтобы увеличить"
            >
              <img src={imageUrl} alt="Изображение" className="nd-block__image" />
            </button>
          </div>
        );
      }

      case "video": {
        const embedUrl = getVkEmbedUrl(block.content);
        if (!embedUrl) {
          const videoHref = safeUrl(block.content);
          if (!videoHref) return null;
          return (
            <div key={block.id || index} className="nd-file">
              <a href={videoHref} target="_blank" rel="noopener noreferrer">
                Открыть видео
              </a>
            </div>
          );
        }
        return (
          <div key={block.id || index} className="nd-video">
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
          <div key={block.id || index} className="nd-file">
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

  return (
    <div className="news-detail-page">
      <Header />

      {loading ? (
        <div className="nd-state">
          <p className="d2-empty">Загрузка статьи...</p>
        </div>
      ) : error || !article ? (
        <div className="nd-state">
          <p className="d2-empty">{error || "Статья не найдена"}</p>
          <button
            type="button"
            className="d2-btn d2-btn--ink"
            onClick={() => navigate("/news")}
          >
            Вернуться к новостям
          </button>
        </div>
      ) : (
        <article className="nd">
          {/* header band */}
          <div className="nd-head">
            <div className="nd-head__glow" aria-hidden="true" />
            <div className="page-container nd-head__inner">
              <button
                type="button"
                className="nd-back"
                onClick={() => navigate("/news")}
              >
                ← Все новости
              </button>
              <h1 className="nd-title">{article.title}</h1>
              {article.summary && (
                <p className="nd-summary">{article.summary}</p>
              )}
              <div className="nd-meta">
                <span>
                  {formatDate(article.published_at || article.date_created)}
                </span>
              </div>
            </div>
          </div>

          {/* body */}
          <div className="nd-body">
            <div className="page-container nd-body__inner">
              {getUploadUrl(article.featured_image) && (
                <button
                  type="button"
                  className="nd-img-btn nd-cover-btn"
                  onClick={() => setLightbox(getUploadUrl(article.featured_image))}
                  title="Нажмите, чтобы увеличить"
                >
                  <img
                    src={getUploadUrl(article.featured_image)}
                    alt={article.title}
                    className="nd-cover"
                  />
                </button>
              )}
              <div className="nd-content">
                {article.blocks?.map((block, index) =>
                  renderBlock(block, index),
                )}
              </div>
            </div>
          </div>
        </article>
      )}

      {lightbox && (
        <div className="nd-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="nd-lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  );
};

export default NewsDetail;
