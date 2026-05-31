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

const GROUPS = [
  {
    title: "Публикации и медиа",
    modules: [
      { title: "Новости", description: "Публикации, статьи и события Центра.", icon: NewsIcon, path: "/admin/cms/news" },
      { title: "История и достижения", description: "Хронология событий и достижений организации.", icon: HistoryIcon, path: "/admin/cms/history" },
      { title: "Наши успехи", description: "Истории успеха детей и семей.", icon: AchievementsIcon, path: "/admin/cms/achievements" },
      { title: "Наши награды", description: "Дипломы, сертификаты и благодарности.", icon: AwardsIcon, path: "/admin/cms/awards" },
      { title: "Шортсы", description: "Видео-истории на главной странице.", icon: ShortsIcon, path: "/admin/cms/shorts" },
    ],
  },
  {
    title: "О центре",
    modules: [
      { title: "Сотрудники", description: "Преподаватели, фото, квалификация и карточки специалистов.", icon: EmployeesIcon, path: "/admin/schedule/teachers" },
      { title: "Услуги", description: "Карточки и описание направлений помощи.", icon: ServicesIcon, path: "/admin/cms/services" },
      { title: "Материально-техническое обеспечение", description: "Помещения, зоны, оборудование и фотографии.", icon: FinIcon, path: "/admin/cms/fin-zones" },
    ],
  },
  {
    title: "Официальные документы",
    modules: [
      { title: "Документы", description: "Файлы раздела официальных документов.", icon: FilesIcon, path: "/admin/cms/docs" },
      { title: "Правила внутреннего распорядка", description: "Документы с правилами внутреннего распорядка.", icon: RulesIcon, path: "/admin/cms/rules" },
      { title: "Независимая оценка качества", description: "Материалы раздела оценки качества услуг.", icon: RatingIcon, path: "/admin/cms/rating" },
    ],
  },
  {
    title: "Клиенты и заявки",
    modules: [
      { title: "Заявки на консультацию", description: "Входящие заявки от родителей.", icon: ConsultationsIcon, path: "/admin/consultations" },
      { title: "Анкеты родителей", description: "Входные анкеты и данные по детям.", icon: QuestionnaireIcon, path: "/admin/questionnaires" },
      { title: "Документы родителей", description: "Проверка документов, поданных родителями.", icon: DocsIcon, path: "/admin/documents" },
      { title: "Пользователи", description: "Родители, сотрудники и привязка учеников.", icon: UsersIcon, path: "/admin/users" },
    ],
  },
  {
    title: "Настройки системы",
    modules: [
      { title: "Настройки сайта", description: "Глобальные данные, миссия, контакты, структура и видео.", icon: SettingsIcon, path: "/admin/cms/settings" },
      { title: "Политика ПДн", description: "Политика обработки персональных данных (152-ФЗ). Без деплоя.", icon: PrivacyIcon, path: "/admin/cms/privacy" },
    ],
  },
];

const ALL_MODULES = GROUPS.flatMap(g => g.modules);

function AdminCMSPanel() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const query = search.toLowerCase().trim();

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
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {query ? (
          /* Flat search results */
          <section className="admin-cms__grid">
            {ALL_MODULES.filter(m =>
              `${m.title} ${m.description}`.toLowerCase().includes(query)
            ).map(m => <ModuleCard key={m.path} module={m} navigate={navigate} />)}
          </section>
        ) : (
          /* Grouped view */
          GROUPS.map(group => (
            <div key={group.title} className="admin-cms__group">
              <h2 className="admin-cms__group-title">{group.title}</h2>
              <section className="admin-cms__grid">
                {group.modules.map(m => <ModuleCard key={m.path} module={m} navigate={navigate} />)}
              </section>
            </div>
          ))
        )}

      </div>
    </main>
  );
}

function ModuleCard({ module, navigate }) {
  const Icon = module.icon;
  return (
    <article className="admin-cms-card" onClick={() => navigate(module.path)} style={{ cursor: "pointer" }}>
      <div className="admin-cms-card__icon">
        <Icon />
      </div>
      <div className="admin-cms-card__content">
        <h2>{module.title}</h2>
        <p>{module.description}</p>
      </div>
      <button type="button" onClick={e => { e.stopPropagation(); navigate(module.path); }}>
        Открыть
      </button>
    </article>
  );
}

export default AdminCMSPanel;
