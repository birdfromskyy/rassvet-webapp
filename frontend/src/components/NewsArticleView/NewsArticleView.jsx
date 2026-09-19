import { useEffect, useState } from "react";
import { getUploadUrl } from "../../services/cmsService";

const getVkEmbedUrl = (url) => {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const hostname = parsed.hostname.toLowerCase();
  const isVkHost = ["vk.com", "vk.ru", "vkvideo.ru"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!isVkHost) return null;
  if (parsed.pathname.includes("video_ext.php")) return url;
  const videoMatch = `${parsed.pathname}${parsed.search}`.match(/video(-?\d+)_(\d+)/);
  if (videoMatch) return `https://vk.com/video_ext.php?oid=${videoMatch[1]}&id=${videoMatch[2]}&hd=2`;
  const clipMatch = `${parsed.pathname}${parsed.search}`.match(/clip(-?\d+)_(\d+)/);
  if (clipMatch) return `https://vk.com/video_ext.php?oid=${clipMatch[1]}&id=${clipMatch[2]}&hd=2`;
  return null;
};

const getUrlBasename = (url) => {
  try { return decodeURIComponent(url.split("/").pop().split("?")[0]) || null; } catch { return null; }
};

const safeUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : null;
  } catch { return null; }
};

export const SummaryParagraphs = ({ children, className }) => {
  const paragraphs = String(children || "")
    .replace(/\r\n/g, "\n")
    // In a textarea every explicit Enter is an intended paragraph boundary.
    // Soft visual wrapping does not add a newline to the value.
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return <div className={className}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
};

function NewsArticleView({
  article,
  onBack,
  backLabel = "← Все новости",
  eyebrow,
  conclusion,
  showDate = true,
  showImageCaptions = true,
}) {
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const renderBlock = (block, index) => {
    if (!block?.type) return null;
    const key = block.id || index;
    if (block.type === "text") {
      return <div key={key} className="nd-block">{String(block.content || "").split("\n").filter((paragraph) => paragraph.trim()).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>;
    }
    if (block.type === "image") {
      const imageUrl = getUploadUrl(block.content);
      return imageUrl ? <figure key={key} className="nd-block nd-block--image"><button type="button" className="nd-img-btn" onClick={() => setLightbox(imageUrl)} title="Нажмите, чтобы увеличить"><img src={imageUrl} alt={block.title || "Изображение"} className="nd-block__image" /></button>{showImageCaptions && block.title && <figcaption>{block.title}</figcaption>}</figure> : null;
    }
    if (block.type === "video") {
      const embedUrl = getVkEmbedUrl(block.content);
      if (embedUrl) return <div key={key} className="nd-video"><iframe src={embedUrl} title="Видео" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /></div>;
      const videoHref = safeUrl(block.content);
      return videoHref ? <div key={key} className="nd-file"><a href={videoHref} target="_blank" rel="noopener noreferrer">Открыть видео</a></div> : null;
    }
    if (block.type === "file") {
      const fileUrl = getUploadUrl(block.content);
      return fileUrl ? <div key={key} className="nd-file"><a href={fileUrl} target="_blank" rel="noopener noreferrer">{block.title || getUrlBasename(block.content) || "Скачать файл"}</a></div> : null;
    }
    return null;
  };

  return <>
    <article className="nd">
      <div className="nd-head"><div className="nd-head__glow" aria-hidden="true" /><div className="page-container nd-head__inner"><button type="button" className="nd-back" onClick={onBack}>{backLabel}</button>{eyebrow && <span className="nd-eyebrow">{eyebrow}</span>}<h1 className="nd-title">{article.title}</h1>{article.summary && <SummaryParagraphs className="nd-summary">{article.summary}</SummaryParagraphs>}{showDate && (article.published_at || article.created_at) && <div className="nd-meta"><span>{formatDate(article.published_at || article.created_at)}</span></div>}</div></div>
      <div className="nd-body"><div className="page-container nd-body__inner">{getUploadUrl(article.featured_image) && <button type="button" className="nd-img-btn nd-cover-btn" onClick={() => setLightbox(getUploadUrl(article.featured_image))} title="Нажмите, чтобы увеличить"><img src={getUploadUrl(article.featured_image)} alt={article.title} className="nd-cover" /></button>}<div className="nd-content">{article.blocks?.map(renderBlock)}{conclusion && <strong className="nd-conclusion">{conclusion}</strong>}</div></div></div>
    </article>
    {lightbox && <div className="nd-lightbox" onClick={() => setLightbox(null)}><button type="button" className="nd-lightbox__close" onClick={() => setLightbox(null)} aria-label="Закрыть">×</button><img src={lightbox} alt="Увеличенное изображение" onClick={(event) => event.stopPropagation()} /></div>}
  </>;
}

export default NewsArticleView;
