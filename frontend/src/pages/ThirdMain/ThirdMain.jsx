import { useEffect, useRef, useState, useCallback } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import Stories from "../../components/Stories/Stories";
import reviewService from "../../services/reviewService";
import shortsService from "../../services/shortsService";
import { serviceCmsService, siteSettingService } from "../../services/cmsService";
import usePageMeta from "../../hooks/usePageMeta";
import "./ThirdMain.scss";

import heroIconHeart from "../../assets/charity.png";
import heroIconChat from "../../assets/professionalism.png";
import heroIconFamily from "../../assets/family-room.png";
import aboutIllustration from "../../assets/sea-and-sun.png";
import ratingQr from "../../assets/rating-qr.jpg";

/* Home page — new design ("Rassvet 2.0", see Skills/Design2.md).
   Brand palette (#074462 / #f4df00 / warm cream) on full-screen
   sections. True fullpage scrolling on desktop: one scroll gesture =
   one screen, regardless of gesture length. This is the live design
   rendered at /main; also reachable at /thirdmain as the reference
   implementation. Fully self-contained and scoped. */

const FONT_LINK_ID = "tm-webfont-manrope";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";

const SECTIONS = [
  { id: "tm-hero", label: "Главная" },
  { id: "tm-about", label: "О центре" },
  { id: "tm-services", label: "Услуги" },
  { id: "tm-stories", label: "Видео" },
  { id: "tm-reviews", label: "Отзывы" },
  { id: "tm-map", label: "Как нас найти" },
  { id: "tm-rating", label: "Оценка работы" },
];

/* The footer participates in fullpage navigation as the final stop,
   but has no dot in the side navigation. */
const SCROLL_STOPS = [...SECTIONS.map((s) => s.id), "tm-footer"];

const FLIP_LOCK_MS = 1000;
const WHEEL_THRESHOLD = 10;
const DESKTOP_QUERY = "(min-width: 993px)";
const DEFAULT_HOME_VIDEO_URL =
  "https://vk.com/video_ext.php?oid=-228149734&id=456239094&hash=1a7c1dffa23542b1";
const RATING_URL = "https://bus.gov.ru/qrcode/rate/818963";
const HOME_SERVICE_PREVIEW_LIMIT = 4;

const toHomeVideoEmbedUrl = (url) => {
  if (!url || url.includes("video_ext.php")) return url || DEFAULT_HOME_VIDEO_URL;

  const match = url.match(/(?:video|clip)(-?\d+)_(\d+)/);
  if (match) {
    return `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2`;
  }

  return url;
};

const parseJson = (str) => {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
};

const getHomeCategoryLabel = (title) => (
  title.includes("коммуникативного потенциала")
    ? "Коммуникативный потенциал"
    : title
);

const directionWord = (count) => {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "направлений";
  if (lastDigit === 1) return "направление";
  if (lastDigit >= 2 && lastDigit <= 4) return "направления";
  return "направлений";
};

/* Reveal-on-scroll. Re-runs when `deps` change so content that
   appears after data loads (e.g. reviews) is picked up too. */
function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(root.querySelectorAll("[data-reveal]")).filter(
      (el) => !el.classList.contains("is-in"),
    );

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, ...deps]);
}

/* Fullpage navigation: any wheel gesture / page key flips exactly
   one screen in the gesture's direction. Desktop only; inner
   scrollable areas (services panel) and the stories modal keep
   native behaviour. */
function useFullpageScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const desktop = window.matchMedia(DESKTOP_QUERY);
    let locked = false;
    let rafId = null;

    const cancelAnim = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const stops = () =>
      SCROLL_STOPS.map((id) => document.getElementById(id)).filter(
        (el) => el && el.offsetParent !== null,
      );

    const currentIndex = (els) => {
      let best = 0;
      let bestDist = Infinity;
      els.forEach((el, i) => {
        const dist = Math.abs(el.getBoundingClientRect().top);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    };

    const flip = (dir) => {
      const els = stops();
      if (els.length === 0) return;
      const i = currentIndex(els);
      const next = Math.min(els.length - 1, Math.max(0, i + dir));
      if (next === i) return;
      locked = true;
      cancelAnim();

      const startY = window.scrollY;
      const endY = Math.round(els[next].getBoundingClientRect().top + startY);
      const t0 = performance.now();
      const ANIM_MS = 480;

      // Ease to the section top, then HOLD exactly there until the lock
      // lifts. Re-pinning every frame overrides trailing trackpad inertia,
      // so the page can't drift a few px past the target and reveal a
      // sliver of the next screen at the bottom.
      const frame = (now) => {
        const elapsed = now - t0;
        if (elapsed < ANIM_MS) {
          const t = elapsed / ANIM_MS;
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, Math.round(startY + (endY - startY) * ease));
          rafId = requestAnimationFrame(frame);
        } else if (elapsed < FLIP_LOCK_MS) {
          window.scrollTo(0, endY);
          rafId = requestAnimationFrame(frame);
        } else {
          window.scrollTo(0, endY);
          rafId = null;
          locked = false;
        }
      };
      rafId = requestAnimationFrame(frame);
    };

    /* True if an ancestor of `node` can itself scroll further in
       this direction — then the gesture belongs to that element. */
    const insideScrollable = (node, dir) => {
      let el = node instanceof Element ? node : null;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const style = window.getComputedStyle(el);
          if (/(auto|scroll)/.test(style.overflowY)) {
            const canDown =
              el.scrollTop + el.clientHeight < el.scrollHeight - 1;
            const canUp = el.scrollTop > 0;
            if (dir > 0 ? canDown : canUp) return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    };

    const modalOpen = () => !!document.querySelector(".stories-modal");

    const onWheel = (e) => {
      if (!desktop.matches || modalOpen()) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // horizontal rails
      const dir = e.deltaY > 0 ? 1 : -1;
      if (insideScrollable(e.target, dir)) return;
      e.preventDefault();
      if (locked || Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
      flip(dir);
    };

    const onKey = (e) => {
      if (!desktop.matches || modalOpen() || locked) return;
      const t = e.target;
      if (
        t instanceof Element &&
        (t.closest("input, textarea, select") || t.isContentEditable)
      ) {
        return;
      }
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        flip(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        flip(-1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnim();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

function ThirdMain() {
  const rootRef = useRef(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [serviceCats, setServiceCats] = useState([]);
  const [activeCatId, setActiveCatId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [hasStories, setHasStories] = useState(true);
  const [homeVideoUrl, setHomeVideoUrl] = useState(DEFAULT_HOME_VIDEO_URL);

  usePageMeta(
    "РАСсвет — центр развития детей с задержками развития",
    "Центр развития детей с задержками развития «РАСсвет» в Ханты-Мансийске: индивидуальные занятия, опытные специалисты, поддержка семьи. Запишитесь на консультацию.",
  );

  /* Font family used only by this page — no visual side effects
     anywhere else on the site. */
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  useFullpageScroll();
  useReveal(rootRef, [reviews.length, serviceCats.length]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.55 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    reviewService.getPublishedReviews().then(setReviews).catch(() => {});
  }, []);

  useEffect(() => {
    siteSettingService
      .getAll()
      .then((settings) => setHomeVideoUrl(toHomeVideoEmbedUrl(settings.home_video_url)))
      .catch(() => {});
  }, []);

  /* Services shown on the home page come from the same CMS source as
     /services-list — nested categories with items, rendered in the
     tab design below. */
  useEffect(() => {
    // Go through serviceCmsService so this shares the CMS cache (the home
    // page is the most-visited — no need to re-fetch services every visit).
    serviceCmsService
      .getAll("services_list")
      .then((data) => {
        const all = (data || [])
          .filter((s) => s.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
        const built = all
          .filter((s) => !s.parent_id)
          .map((section) => ({
            ...section,
            children: all
              .filter((s) => s.parent_id === section.id)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((child) => ({ ...child, subItems: parseJson(child.items) })),
          }));
        // A category is a top-level service with its own entries. All five
        // are available on the home page; the right panel is independently
        // scrollable, so a long category does not break full-page scrolling.
        const categories = built.filter((section) => section.children.length > 0);
        setServiceCats(categories);
        if (categories.length) setActiveCatId(categories[0].id);
      })
      .catch(() => {});
  }, []);

  /* Know upfront whether the video screen has content, so the empty
     section can be dropped without relying on the CSS :has() selector
     (unsupported in older browsers). Stories fetches its own copy. */
  useEffect(() => {
    shortsService
      .getPublic()
      .then((list) => setHasStories(Array.isArray(list) && list.length > 0))
      .catch(() => setHasStories(false));
  }, []);

  const scrollToSection = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const activeCat =
    serviceCats.find((c) => c.id === activeCatId) || serviceCats[0] || null;
  const activeCatPreview = activeCat?.children.slice(0, HOME_SERVICE_PREVIEW_LIMIT) || [];
  const hiddenServiceCount = Math.max(0, (activeCat?.children.length || 0) - activeCatPreview.length);
  const stars = (n) => "★".repeat(Math.min(5, Math.max(1, n)));

  return (
    <div className="third-main" ref={rootRef}>
      <Header />

      <nav className="tm-dots" aria-label="Разделы страницы">
        {SECTIONS.filter(({ id }) => id !== "tm-stories" || hasStories).map(
          ({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`tm-dots__dot${activeSection === id ? " is-active" : ""}`}
              onClick={() => scrollToSection(id)}
              aria-label={label}
            >
              <span className="tm-dots__tip">{label}</span>
            </button>
          ),
        )}
      </nav>

      {/* ── Screen 1: Hero ────────────────────────────────────── */}
      <section className="tm-section tm-hero" id="tm-hero">
        <div className="tm-hero__glow" aria-hidden="true" />
        <div className="page-container tm-hero__inner">
          <div className="tm-hero__content" data-reveal>
            <span className="tm-tag">Мы рядом. Мы помогаем</span>

            <h1 className="tm-hero__title">
              Маленькими шагами
              <br />
              к&nbsp;большим возможностям
            </h1>

            <p className="tm-hero__text">
              Помогаем детям с задержками развития раскрывать потенциал и
              достигать уверенности в каждом шаге.
            </p>

            <div className="tm-hero__actions">
              <a href="/consultation-request" className="tm-btn tm-btn--yellow">
                Записаться на консультацию
              </a>
              <a href="/services-list" className="tm-btn tm-btn--outline-light">
                Узнать больше
              </a>
            </div>

            <div className="tm-hero__features">
              <div className="tm-hero__feature">
                <span className="tm-hero__feature-icon">
                  <img src={heroIconHeart} alt="" />
                </span>
                <span>Индивидуальный подход</span>
              </div>
              <a href="/employees" className="tm-hero__feature">
                <span className="tm-hero__feature-icon">
                  <img src={heroIconChat} alt="" />
                </span>
                <span>Опытные специалисты</span>
              </a>
              <div className="tm-hero__feature">
                <span className="tm-hero__feature-icon">
                  <img src={heroIconFamily} alt="" />
                </span>
                <span>Поддержка семьи</span>
              </div>
            </div>
          </div>

          <div className="tm-hero__visual" data-reveal data-reveal-delay="1">
            <div className="tm-hero__video-card">
              <iframe
                src={homeVideoUrl}
                title="Видеовизитка Центра"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
              <div className="tm-hero__video-caption">Видеовизитка Центра</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="tm-scroll-hint"
          onClick={() => scrollToSection("tm-about")}
          aria-label="Прокрутить к следующему разделу"
        >
          ↓
        </button>
      </section>

      {/* ── Screen 2: About ───────────────────────────────────── */}
      <section className="tm-section tm-about" id="tm-about">
        <div className="page-container tm-about__inner">
          <div className="tm-about__intro" data-reveal>
            <span className="tm-tag tm-tag--dark">О нашем центре</span>
            <h2 className="tm-h2">
              Создаём возможности для полноценного развития
            </h2>
            <p className="tm-about__lead">
              Помогаем детям с задержками развития адаптироваться в обществе,
              раскрывать потенциал и чувствовать себя увереннее в каждом шаге.
            </p>
            <a href="/mission" className="tm-btn tm-btn--ink">
              Подробнее о центре
            </a>
            <img
              src={aboutIllustration}
              alt="Иллюстрация о центре"
              className="tm-about__illustration"
            />
          </div>

          <ol className="tm-about__facts" data-reveal data-reveal-delay="1">
            <li className="tm-about__fact">
              <span className="tm-about__fact-num">01</span>
              <p>Работаем с 1 октября 2021 года.</p>
            </li>
            <li className="tm-about__fact">
              <span className="tm-about__fact-num">02</span>
              <p>
                Целевая аудитория – дети с расстройствами аутистического
                спектра и прочими ментальными нарушениями.
              </p>
            </li>
            <li className="tm-about__fact">
              <span className="tm-about__fact-num">03</span>
              <p>Являемся поставщиком социальных услуг.</p>
            </li>
            <li className="tm-about__fact">
              <span className="tm-about__fact-num">04</span>
              <p>
                Сопровождаем семьи по индивидуальным программам предоставления
                социальных услуг.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Screen 3: Services (tabs) ─────────────────────────── */}
      <section className="tm-section tm-services" id="tm-services">
        <div className="page-container tm-services__inner">
          <div className="tm-services__side" data-reveal>
            <h2 className="tm-h2">Наши услуги</h2>

            <div className="tm-services__tabs" role="tablist" aria-label="Категории услуг">
              {serviceCats.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCatId === cat.id}
                  aria-label={cat.title}
                  title={cat.title}
                  className={`tm-services__tab${
                    activeCatId === cat.id ? " is-active" : ""
                  }`}
                  onClick={() => setActiveCatId(cat.id)}
                >
                  <span className="tm-services__tab-dot" aria-hidden="true" />
                  <span>{getHomeCategoryLabel(cat.title)}</span>
                </button>
              ))}
            </div>

            <a href="/services-list" className="tm-btn tm-btn--ink">
              Все услуги
            </a>
          </div>

          <div className="tm-services__panel" data-reveal data-reveal-delay="1" role="tabpanel">
            {activeCat && (
              <>
                <h3 className="tm-services__panel-title">{getHomeCategoryLabel(activeCat.title)}</h3>
                <p className="tm-services__panel-text">
                  Краткий перечень направлений. Полный официальный список доступен отдельно.
                </p>
                {activeCatPreview.length > 0 && (
                  <ul className="tm-services__list">
                    {activeCatPreview.map((child) => (
                      <li key={child.id}>
                        <strong>{child.title}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {hiddenServiceCount > 0 && (
                  <p className="tm-services__more">
                    Ещё {hiddenServiceCount} {directionWord(hiddenServiceCount)} — в полном перечне.
                  </p>
                )}
                <a href={`/services-list#service-${activeCat.id}`} className="tm-services__detail-link">
                  Открыть полный перечень
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Screen 4: Video stories (reuses Stories) ───────────── */}
      {hasStories && (
        <section className="tm-section tm-stories" id="tm-stories">
          <div className="tm-stories__glow" aria-hidden="true" />
          <div className="page-container tm-stories__head" data-reveal>
            <span className="tm-tag">Видео</span>
            <h2 className="tm-h2 tm-h2--light">Моменты из жизни центра</h2>
          </div>
          <div className="tm-stories__rail" data-reveal data-reveal-delay="1">
            <Stories />
          </div>
        </section>
      )}

      {/* ── Screen 5: Reviews (horizontal snap rail) ───────────── */}
      <section className="tm-section tm-reviews" id="tm-reviews">
        <div className="page-container tm-reviews__head" data-reveal>
          <h2 className="tm-h2">Отзывы родителей</h2>
          <a href="/reviews" className="tm-btn tm-btn--ink">
            Все отзывы
          </a>
        </div>

        {reviews.length > 0 ? (
          <div className="tm-reviews__rail" data-reveal data-reveal-delay="1">
            {reviews.slice(0, 3).map((r) => (
              <article className="tm-review" key={r.id}>
                <span className="tm-review__quote" aria-hidden="true">
                  “
                </span>
                <div className="tm-review__meta tm-review__meta--top">
                  <div className="tm-review__author">{r.author_name}</div>
                  <div className="tm-review__stars">{stars(r.rating)}</div>
                </div>
                <p className="tm-review__content">{r.content}</p>
                {r.source_platform && (
                  <div className="tm-review__source">{r.source_platform}</div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="page-container tm-reviews__empty" data-reveal>
            Отзывы появятся здесь.
          </p>
        )}
      </section>

      {/* ── Screen 6: Map ─────────────────────────────────────── */}
      <section className="tm-section tm-map" id="tm-map">
        <div className="page-container tm-map__inner">
          <div className="tm-map__info" data-reveal>
            <span className="tm-tag tm-tag--dark">Как нас найти</span>
            <h2 className="tm-h2">Адрес Центра</h2>
            <p>ХМАО — Югра, г. Ханты-Мансийск, пер. Нагорный, д. 3</p>
          </div>
          <div className="tm-map__frame" data-reveal data-reveal-delay="1">
            <iframe
              src="https://yandex.ru/map-widget/v1/?ll=69.018902%2C61.004170&z=16&mode=search&text=Ханты-Мансийск%20пер.%20Нагорный%203"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              loading="lazy"
              title="Карта проезда к Центру РАСсвет"
            />
          </div>
        </div>
      </section>

      {/* ── Screen 7: Independent quality assessment ────────── */}
      <section className="tm-section tm-rating" id="tm-rating">
        <div className="page-container tm-rating__inner">
          <div className="tm-rating__content" data-reveal>
            <span className="tm-tag tm-tag--dark">Независимая оценка</span>
            <h2 className="tm-h2">Оцените нашу работу</h2>
            <p className="tm-rating__lead">Вы можете оценить условия оказания услуг:</p>
            <ul className="tm-rating__list">
              <li>Комфорт и чистоту помещений</li>
              <li>Доброжелательность и вежливость персонала</li>
              <li>Лёгкость получения информации о работе организации и её точность</li>
              <li>Удобство записи для получения услуг и своевременность их оказания</li>
              <li>Доступность для граждан с инвалидностью</li>
            </ul>
            <a href={RATING_URL} className="tm-btn tm-btn--ink" target="_blank" rel="noreferrer">
              Оценить на bus.gov.ru
            </a>
          </div>
          <a
            href={RATING_URL}
            className="tm-rating__qr"
            target="_blank"
            rel="noreferrer"
            data-reveal
            data-reveal-delay="1"
            aria-label="Перейти к оценке работы Центра на bus.gov.ru"
          >
            <img src={ratingQr} alt="QR-код для независимой оценки качества работы Центра" />
            <span>Наведите камеру телефона на QR-код</span>
          </a>
        </div>
      </section>

      {/* Final fullpage stop: footer */}
      <div id="tm-footer">
        <Footer />
      </div>
    </div>
  );
}

export default ThirdMain;
