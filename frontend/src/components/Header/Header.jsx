import "./Header.scss";
import {
  FiSearch,
  FiEye,
  FiMapPin,
  FiPhone,
  FiChevronDown,
  FiMenu,
  FiX,
  FiHome,
  FiInfo,
  FiLayers,
  FiRadio,
  FiBell,
  FiUser,
} from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { siteSettingService } from "../../services/cmsService";
import notificationService from "../../services/notificationService";

const searchPages = [
  { title: "Главная", path: "/main" },
  { title: "Миссия и цели", path: "/mission" },
  { title: "История и достижения", path: "/history" },
  { title: "Документы", path: "/docs" },
  { title: "Сотрудники", path: "/employees" },
  { title: "Структура организации", path: "/structure" },
  { title: "Перечень услуг", path: "/services-list" },
  { title: "Описание услуг", path: "/services-description" },
  { title: "Алгоритм получения услуг", path: "/service-algorithm" },
  { title: "Контакты", path: "/contacts" },
  { title: "Новости", path: "/news" },
  { title: "Независимая оценка качества", path: "/rating" },
  { title: "Форма социального обслуживания", path: "/social-service-form" },
  { title: "Свободные места", path: "/available-places" },
  { title: "Наши успехи", path: "/achievements" },
  { title: "Наши награды", path: "/awards" },
  { title: "Первичная консультация", path: "/consultation-request" },
];

const dropdowns = [
  {
    id: "about",
    title: "О центре",
    icon: <FiInfo />,
    links: [
      { title: "Миссия и цели", path: "/mission" },
      { title: "История и достижения", path: "/history" },
      { title: "Наши успехи", path: "/achievements" },
      { title: "Наши награды", path: "/awards" },
      { title: "Документы", path: "/docs" },
      { title: "Сотрудники", path: "/employees" },
      {
        title: "Материально-техническое обеспечение",
        path: "/fin-activities",
      },
      { title: "О правилах внутреннего распорядка", path: "/internal-rules" },
      { title: "Структура организации", path: "/structure" },
      { title: "Независимая оценка качества", path: "/rating" },
    ],
  },
  {
    id: "clients",
    title: "Для клиентов",
    icon: <FiUser />,
    links: [
      {
        title: "Записаться на консультацию",
        path: "/consultation-request",
      },
      { title: "Отзывы", path: "/reviews" },
      { title: "Алгоритм получения услуг", path: "/service-algorithm" },
      { title: "Свободные места", path: "/available-places" },
      {
        title: "Форма социального обслуживания",
        path: "/social-service-form",
      },
    ],
  },
  {
    id: "services",
    title: "Услуги",
    icon: <FiLayers />,
    links: [
      { title: "Перечень соц. услуг", path: "/services-list" },
      { title: "Описание услуг", path: "/services-description" },
    ],
  },
];

function Header() {
  const [searchValue, setSearchValue] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [cmsSettings, setCmsSettings] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const isLoggedIn = !!localStorage.getItem("token");

  const navigate = useNavigate();

  const filteredPages = searchPages.filter((page) =>
    page.title.toLowerCase().includes(searchValue.toLowerCase().trim()),
  );

  useEffect(() => {
    siteSettingService.getAll().then(setCmsSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const load = () => {
      notificationService.getUnreadCount().then(({ count }) => setUnreadCount(count)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000); // poll every minute
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!bellOpen) return;
    notificationService.getAll().then(setNotifications).catch(() => {});
  }, [bellOpen]);

  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotifClick = async (n) => {
    if (!n.is_read) {
      await notificationService.markOneRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((item) => item.id === n.id ? { ...item, is_read: true } : item)
      );
    }
    setBellOpen(false);
    if (n.link) navigate(n.link);
  };

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (isMenuOpen) return;

      if (currentScrollY <= 10) {
        setIsHidden(false);
      } else if (currentScrollY > lastScrollY) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMenuOpen]);

  const toggleDropdown = (id) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setOpenDropdown(null);
  };

  const goToFirstSearchResult = () => {
    if (filteredPages[0]) {
      navigate(filteredPages[0].path);
      setSearchValue("");
      closeMenu();
    }
  };

  return (
    <header className={`header ${isHidden ? "header--hidden" : ""}`}>
      <div className="container header__container">
        <div className="header__top">
          <button
            className="header__accessibility"
            type="button"
            onClick={() => {
              localStorage.setItem("accessibility", "on");
              window.location.reload();
            }}
          >
            <FiEye />
            <span>Версия для слабовидящих</span>
          </button>

          <div className="header__contacts">
            <a href="/contacts" className="header__top-link">
              <FiMapPin />
              <span>{cmsSettings.header_address || "пер. Нагорный д.3"}</span>
            </a>

            <a
              href={`tel:${(cmsSettings.header_phone || "+7 (900) 397-34-59").replace(/\D/g, "").replace(/^8/, "+7")}`}
              className="header__top-link"
            >
              <FiPhone />
              <span>{cmsSettings.header_phone || "+7 (900) 397-34-59"}</span>
            </a>
          </div>
        </div>

        <div className="header__main">
          <Link to="/main" className="header__logo" onClick={closeMenu}>
            <img src={logo} alt="Логотип центра РАСсвет" />
          </Link>

          <div className="header__center">
            <nav className={`header__nav ${isMenuOpen ? "is-open" : ""}`}>
              <NavLink
                to="/main"
                className="header__nav-link"
                onClick={closeMenu}
              >
                <FiHome />
                <span>Главная</span>
              </NavLink>

              {dropdowns.map((dropdown) => (
                <div
                  className={`header__nav-item header__nav-item--dropdown ${
                    openDropdown === dropdown.id ? "is-open" : ""
                  }`}
                  key={dropdown.id}
                >
                  <button
                    type="button"
                    className="header__nav-link header__nav-link--trigger"
                    onClick={() => toggleDropdown(dropdown.id)}
                  >
                    {dropdown.icon}
                    <span>{dropdown.title}</span>
                    <FiChevronDown className="header__chevron" />
                  </button>

                  <div className="header__dropdown">
                    {dropdown.links.map((link) => (
                      <NavLink
                        to={link.path}
                        key={link.path}
                        onClick={closeMenu}
                      >
                        {link.title}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}

              <NavLink
                to="/news"
                className="header__nav-link"
                onClick={closeMenu}
              >
                <FiRadio />
                <span>Новости</span>
              </NavLink>

              <NavLink
                to="/contacts"
                className="header__nav-link"
                onClick={closeMenu}
              >
                <FiPhone />
                <span>Контакты</span>
              </NavLink>
            </nav>

            <div className="header__search">
              <button
                type="button"
                className="header__search-btn"
                onClick={goToFirstSearchResult}
                aria-label="Поиск"
              >
                <FiSearch />
              </button>

              <input
                className="header__search-input"
                placeholder="Поиск..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goToFirstSearchResult();
                }}
              />

              {searchValue.trim() && filteredPages.length > 0 && (
                <div className="header__search-results">
                  {filteredPages.slice(0, 6).map((page) => (
                    <button
                      key={page.path}
                      type="button"
                      onClick={() => {
                        navigate(page.path);
                        setSearchValue("");
                        closeMenu();
                      }}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="header__actions">
            <Link
              to="/consultation-request"
              className="header__consultation"
              onClick={closeMenu}
            >
              Записаться
            </Link>

            <Link to={isLoggedIn ? "/dashboard" : "/login"} className="header__account" onClick={closeMenu}>
              Личный кабинет
            </Link>

            {isLoggedIn && (
              <div className="header__bell" ref={bellRef}>
                <button
                  type="button"
                  className="header__bell-btn"
                  onClick={() => setBellOpen((p) => !p)}
                  aria-label="Уведомления"
                >
                  <FiBell />
                  {unreadCount > 0 && (
                    <span className="header__bell-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </button>

                {bellOpen && (
                  <div className="header__bell-dropdown">
                    <div className="header__bell-header">
                      <span>Уведомления</span>
                      {unreadCount > 0 && (
                        <button type="button" onClick={handleMarkAllRead}>
                          Прочитать все
                        </button>
                      )}
                    </div>
                    <div className="header__bell-list">
                      {notifications.length === 0 ? (
                        <p className="header__bell-empty">Нет уведомлений</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            className={`header__bell-item${n.is_read ? "" : " header__bell-item--unread"}`}
                            onClick={() => handleNotifClick(n)}
                          >
                            <span className="header__bell-title">{n.title}</span>
                            <span className="header__bell-body">{n.body.replace(/^\[uid:\d+\]\s*/, '')}</span>
                            <span className="header__bell-time">
                              {new Date(n.created_at).toLocaleDateString("ru-RU", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="header__burger"
              type="button"
              onClick={() => {
                setIsMenuOpen((prev) => !prev);
                setOpenDropdown(null);
              }}
              aria-label="Открыть меню"
            >
              {isMenuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
