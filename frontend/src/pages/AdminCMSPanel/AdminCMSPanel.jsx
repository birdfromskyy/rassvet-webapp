import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  People as EmployeesIcon,
  Folder as FilesIcon,
  Gavel as RulesIcon,
  EmojiEvents as RatingIcon,
  History as HistoryIcon,
  AccountBalance as FinIcon,
  MiscellaneousServices as ServicesIcon,
  Settings as SettingsIcon,
  Article as NewsIcon,
  ManageAccounts as UsersIcon,
  ArrowBack as BackIcon,
  AssignmentInd as DocsIcon,
  Stars as AchievementsIcon,
  MilitaryTech as AwardsIcon,
  ContactPhone as ConsultationsIcon,
  Description as QuestionnaireIcon,
  VideoLibrary as ShortsIcon,
  Security as PrivacyIcon,
} from "@mui/icons-material";

import "./AdminCMSPanel.scss";

const MODULES = [
  {
    title: "Сотрудники",
    description: "Преподаватели, фото, квалификация и карточки специалистов.",
    icon: EmployeesIcon,
    path: "/admin/schedule/teachers",
  },
  {
    title: "Новости",
    description: "Публикации, статьи и события Центра.",
    icon: NewsIcon,
    path: "/admin/cms/news",
  },
  {
    title: "История и достижения",
    description: "Хронология событий и достижений организации.",
    icon: HistoryIcon,
    path: "/admin/cms/history",
  },
  {
    title: "Документы",
    description: "Файлы раздела официальных документов.",
    icon: FilesIcon,
    path: "/admin/cms/docs",
  },
  {
    title: "Правила внутреннего распорядка",
    description: "Документы с правилами внутреннего распорядка.",
    icon: RulesIcon,
    path: "/admin/cms/rules",
  },
  {
    title: "Независимая оценка качества",
    description: "Материалы раздела оценки качества услуг.",
    icon: RatingIcon,
    path: "/admin/cms/rating",
  },
  {
    title: "Материально-техническое обеспечение",
    description: "Помещения, зоны, оборудование и фотографии.",
    icon: FinIcon,
    path: "/admin/cms/fin-zones",
  },
  {
    title: "Услуги",
    description: "Карточки и описание направлений помощи.",
    icon: ServicesIcon,
    path: "/admin/cms/services",
  },
  {
    title: "Настройки сайта",
    description: "Глобальные данные, миссия, структура и видео.",
    icon: SettingsIcon,
    path: "/admin/cms/settings",
  },
  {
    title: "Пользователи",
    description: "Родители, сотрудники и привязка учеников.",
    icon: UsersIcon,
    path: "/admin/users",
  },
  {
    title: "Документы родителей",
    description: "Проверка документов, поданных родителями.",
    icon: DocsIcon,
    path: "/admin/documents",
  },
  {
    title: "Наши успехи",
    description: "Истории успеха детей и семей.",
    icon: AchievementsIcon,
    path: "/admin/cms/achievements",
  },
  {
    title: "Наши награды",
    description: "Дипломы, сертификаты и благодарности.",
    icon: AwardsIcon,
    path: "/admin/cms/awards",
  },
  {
    title: "Заявки на консультацию",
    description: "Входящие заявки от родителей.",
    icon: ConsultationsIcon,
    path: "/admin/consultations",
  },
  {
    title: "Анкеты родителей",
    description: "Входные анкеты и данные по детям.",
    icon: QuestionnaireIcon,
    path: "/admin/questionnaires",
  },
  {
    title: "Шортсы",
    description: "Видео-истории на главной странице.",
    icon: ShortsIcon,
    path: "/admin/cms/shorts",
  },
  {
    title: "Политика ПДн",
    description: "Политика обработки персональных данных (152-ФЗ). Редактируется без деплоя.",
    icon: PrivacyIcon,
    path: "/admin/cms/privacy",
  },
];

function AdminCMSPanel() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const filteredModules = MODULES.filter((module) => {
    const value = `${module.title} ${module.description}`.toLowerCase();
    return value.includes(search.toLowerCase().trim());
  });
  return (
    <main className="admin-cms">
      <div className="admin-cms__container">
        <section className="admin-cms__hero">
          <div>
            <span className="admin-cms__badge">Панель администратора</span>

            <h1>Управление сайтом</h1>

            <p>
              Редактирование публичных страниц, материалов, документов, новостей
              и пользовательского контента Центра «РАСсвет».
            </p>
          </div>

          <div className="admin-cms__actions">
            <button
              type="button"
              className="admin-cms__back"
              onClick={() => navigate("/dashboard")}
            >
              <BackIcon />
              На главную
            </button>
          </div>
        </section>

        <div className="admin-cms__search">
          <input
            type="text"
            placeholder="Найти раздел..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <section className="admin-cms__grid">
          {filteredModules.map((module) => {
            const Icon = module.icon;

            return (
              <article className="admin-cms-card" key={module.path}>
                <div className="admin-cms-card__icon">
                  <Icon />
                </div>

                <div className="admin-cms-card__content">
                  <h2>{module.title}</h2>
                  <p>{module.description}</p>
                </div>

                <button type="button" onClick={() => navigate(module.path)}>
                  Открыть
                </button>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export default AdminCMSPanel;
