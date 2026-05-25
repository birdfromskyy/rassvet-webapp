import "./Header.scss";
import {
  FiSearch,
  FiEye,
  FiUser,
  FiMapPin,
  FiPhone,
  FiChevronDown,
  FiMenu,
  FiX,
} from "react-icons/fi";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

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
];

const dropdowns = [
  {
    id: "about",
    title: "О центре",
    links: [
      { title: "Миссия и цели", path: "/mission" },
      { title: "История и достижения", path: "/history" },
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
    id: "services",
    title: "Услуги",
    small: true,
    links: [
      { title: "Перечень соц. услуг", path: "/services-list" },
      { title: "Описание услуг", path: "/services-description" },
    ],
  },
  {
    id: "clients",
    title: "Для клиентов",
    links: [
      { title: "Алгоритм получения услуг", path: "/service-algorithm" },
      { title: "Кол-во свободных мест", path: "/available-places" },
      { title: "Отзывы клиентов", path: "/reviews" },
      { title: "Форма социального обслуживания", path: "/social-service-form" },
    ],
  },
];

function Header() {
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();

  const filteredPages = searchPages.filter((page) =>
    page.title.toLowerCase().includes(searchValue.toLowerCase().trim()),
  );

  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

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

  return (
    <header className={`header ${isHidden ? "header--hidden" : ""}`}>
      <div className="container header__container">
        <div className="header__top">
          <button className="header__accessibility" type="button">
            <FiEye />
            <span>Версия для слабовидящих</span>
          </button>

          <div className="header__contacts">
            <a href="#contacts" className="header__top-link">
              <FiMapPin />
              <span>пер. Нагорный, д. 3</span>
            </a>

            <a href="tel:+79003973459" className="header__top-link">
              <FiPhone />
              <span>+7 (900) 397-34-59</span>
            </a>
          </div>
        </div>

        <div className="header__middle">
          <Link to="/main" className="header__logo" onClick={closeMenu}>
            <img src={logo} alt="Логотип центра РАСсвет" />
          </Link>

<div className="header__search">
  <button
    type="button"
    className="header__search-btn"
    onClick={() => {
      if (filteredPages[0]) {
        navigate(filteredPages[0].path);
        setSearchValue("");
      }
    }}
  >
    <FiSearch></FiSearch>
  </button>

  <input
    className="header__search-input"
    placeholder="Поиск"
    value={searchValue}
    onChange={(e) => setSearchValue(e.target.value)}
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
          }}
        >
          {page.title}
        </button>
      ))}
    </div>
  )}
</div>

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

          <nav className={`header__nav ${isMenuOpen ? "is-open" : ""}`}>
            <NavLink
              to="/main"
              className="header__nav-link"
              onClick={closeMenu}
            >
              Главная
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
                  <span>{dropdown.title}</span>
                  <FiChevronDown />
                </button>

                <div
                  className={`header__dropdown ${
                    dropdown.small ? "header__dropdown--small" : ""
                  }`}
                >
                  {dropdown.links.map((link) => (
                    <NavLink to={link.path} key={link.path} onClick={closeMenu}>
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
              Новости
            </NavLink>

            <NavLink
              to="/contacts"
              className="header__nav-link"
              onClick={closeMenu}
            >
              Контакты
            </NavLink>

            <NavLink
              to="/donation"
              className="header__nav-link"
              onClick={closeMenu}
            >
              Пожертвование
            </NavLink>
          </nav>

          <Link to="/login" className="header__login" aria-label="Войти">
            {" "}
            <FiUser />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
