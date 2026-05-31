import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import {
  siteSettingService,
  uploadFile,
  getUploadUrl,
} from "../services/cmsService";

import "./AdminModule.scss";

const MODULE_TITLE = "Настройки сайта";
const PUBLIC_PAGE_URL = "/main";

const JSON_ARRAY_KEYS = ["mission_goals", "about_our_services"];

const SECTIONS = [
  {
    title: "Шапка сайта",
    fields: [
      { key: "header_address", label: "Адрес в шапке", multiline: false },
      { key: "header_phone", label: "Телефон в шапке", multiline: false },
    ],
  },
  {
    title: "Подвал сайта",
    fields: [
      { key: "footer_phone1", label: "Телефон 1", multiline: false },
      { key: "footer_phone2", label: "Телефон 2", multiline: false },
      {
        key: "footer_address",
        label: "Адрес",
        multiline: true,
        rows: 2,
      },
      { key: "footer_email", label: "Email", multiline: false },
      { key: "footer_vk_url", label: "Ссылка ВКонтакте", multiline: false },
      {
        key: "footer_copyright",
        label: "Копирайт",
        multiline: false,
      },
    ],
  },
  {
    title: "Контакты",
    hint: "Каждая строка в поле отображается отдельной строкой на сайте.",
    fields: [
      {
        key: "contacts_management",
        label: "Блок «Руководство»",
        multiline: true,
        rows: 3,
      },
      {
        key: "contacts_phones",
        label: "Блок «Телефоны»",
        multiline: true,
        rows: 3,
      },
      {
        key: "contacts_email",
        label: "Блок «Email»",
        multiline: false,
      },
      {
        key: "contacts_addresses",
        label: "Блок «Адреса»",
        multiline: true,
        rows: 4,
      },
      {
        key: "contacts_hours",
        label: "Блок «Режим работы»",
        multiline: true,
        rows: 3,
      },
    ],
  },
  {
    title: "Анкетирование",
    hint: "Загрузите Word-бланк анкеты. Пользователи смогут скачать его и загрузить заполненный обратно.",
    fields: [
      {
        key: "questionnaire_template_url",
        label: "Бланк входной анкеты",
        multiline: false,
        isFile: true,
      },
    ],
  },
  {
    title: "Главная страница",
    fields: [
      {
        key: "home_video_url",
        label: "Ссылка на видео-визитку",
        multiline: false,
      },
    ],
  },
  {
    title: "Миссия",
    fields: [
      {
        key: "mission_hero_text",
        label: "Миссия центра",
        multiline: true,
        rows: 3,
      },
      {
        key: "mission_goals",
        label: "Цели центра",
        multiline: true,
        rows: 6,
        isJsonArray: true,
      },
    ],
  },
  {
    title: "Структура организации",
    fields: [
      {
        key: "structure_photo_url",
        label: "Фото структуры",
        multiline: false,
        isPhoto: true,
      },
    ],
  },
  {
    title: "Описание услуг",
    fields: [
      {
        key: "about_our_services",
        label: "Наши услуги",
        multiline: true,
        rows: 8,
        isJsonArray: true,
      },
    ],
  },
  {
    title: "Свободные места",
    fields: [
      {
        key: "available_stats_total",
        label: "Общее количество мест",
        multiline: false,
      },
      {
        key: "available_stats_budget",
        label: "За счёт бюджетных ассигнований",
        multiline: false,
      },
      {
        key: "available_stats_personal",
        label: "За счёт средств физических лиц",
        multiline: false,
      },
      {
        key: "available_stats_form_text",
        label: "Форма обслуживания",
        multiline: true,
        rows: 2,
      },
    ],
  },
];

export default function AdminSiteSettings() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const toDisplay = (key, value) => {
    if (!value) return "";

    if (JSON_ARRAY_KEYS.includes(key)) {
      try {
        return JSON.parse(value).join("\n");
      } catch {
        return value;
      }
    }

    return value;
  };

  const toStorage = (key, value) => {
    if (JSON_ARRAY_KEYS.includes(key)) {
      return JSON.stringify(
        value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }

    return value;
  };

  useEffect(() => {
    siteSettingService
      .getAll()
      .then((raw) => {
        const display = {};

        Object.entries(raw).forEach(([key, value]) => {
          display[key] = toDisplay(key, value);
        });

        setSettings(display);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (key) => {
    setSaving(key);

    try {
      const value = toStorage(key, settings[key] || "");

      await siteSettingService.upsert(key, value);

      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  const handleUpload = async (key, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadFile(file);

      setSettings((prev) => ({
        ...prev,
        [key]: url,
      }));

      await siteSettingService.upsert(key, url);

      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setUploading(false);
    }
  };

  const filteredSections = SECTIONS.filter((section) => {
    const value = `
      ${section.title}
      ${section.hint || ""}
      ${section.fields.map((field) => field.label).join(" ")}
    `.toLowerCase();

    return value.includes(search.toLowerCase().trim());
  });

  if (loading) {
    return (
      <main className="admin-module">
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </main>
    );
  }

  return (
    <main className="admin-module">
      <div className="admin-module__container">
        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>

            <h1>{MODULE_TITLE}</h1>

            <p>
              Управление глобальными данными сайта: контактами, шапкой,
              подвалом, миссией, анкетами, структурой организации и основными
              информационными блоками.
            </p>
          </div>

          <div className="admin-module__actions">
            <Button
              startIcon={<BackIcon />}
              onClick={() => navigate("/admin/cms")}
              className="admin-module__button admin-module__button--ghost"
            >
              Назад
            </Button>

            <Button
              component="a"
              href={PUBLIC_PAGE_URL}
              target="_blank"
              rel="noreferrer"
              className="admin-module__button admin-module__button--outline"
            >
              Перейти на главную
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          <div className="admin-module__toolbar">
            <div className="admin-module__search">
              <SearchIcon />

              <input
                type="text"
                placeholder="Поиск по настройкам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="admin-module__count">
              Найдено: {filteredSections.length}
            </span>
          </div>

          <div className="admin-settings-grid">
            {filteredSections.map((section) => (
              <article className="admin-settings-card" key={section.title}>
                <div className="admin-settings-card__head">
                  <h2>{section.title}</h2>

                  {section.hint && <p>{section.hint}</p>}
                </div>

                <div className="admin-settings-card__fields">
                  {section.fields.map((field) => (
                    <div className="admin-settings-field" key={field.key}>
                      {field.isFile ? (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mb={1}
                          >
                            {field.label}
                          </Typography>

                          <div className="admin-file-card">
                            {settings[field.key] ? (
                              <a
                                href={getUploadUrl(settings[field.key])}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Открыть текущий файл
                              </a>
                            ) : (
                              <span>Файл пока не загружен</span>
                            )}

                            <Button
                              variant="outlined"
                              component="label"
                              disabled={uploading}
                            >
                              {uploading
                                ? "Загружается..."
                                : "Загрузить файл"}

                              <input
                                type="file"
                                accept=".doc,.docx,.pdf"
                                hidden
                                onChange={(e) => handleUpload(field.key, e)}
                              />
                            </Button>
                          </div>

                          {saved === field.key && (
                            <Alert severity="success" sx={{ mt: 1 }}>
                              Сохранено!
                            </Alert>
                          )}
                        </>
                      ) : field.isPhoto ? (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mb={1}
                          >
                            {field.label}
                          </Typography>

                          {settings[field.key] && (
                            <img
                              src={getUploadUrl(settings[field.key])}
                              alt=""
                              className="admin-settings-preview"
                            />
                          )}

                          <Button
                            variant="outlined"
                            component="label"
                            disabled={uploading}
                          >
                            {uploading ? "Загружается..." : "Загрузить фото"}

                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => handleUpload(field.key, e)}
                            />
                          </Button>

                          {saved === field.key && (
                            <Alert severity="success" sx={{ mt: 1 }}>
                              Сохранено!
                            </Alert>
                          )}
                        </>
                      ) : (
                        <div className="admin-settings-input-row">
                          <TextField
                            label={field.label}
                            value={settings[field.key] || ""}
                            onChange={(e) =>
                              handleChange(field.key, e.target.value)
                            }
                            fullWidth
                            multiline={field.multiline}
                            rows={field.rows || 1}
                            helperText={
                              field.isJsonArray
                                ? "Каждая строка — отдельный пункт"
                                : saved === field.key
                                ? "✓ Сохранено"
                                : undefined
                            }
                            FormHelperTextProps={{
                              style: {
                                color:
                                  saved === field.key ? "green" : undefined,
                              },
                            }}
                          />

                          <Button
                            startIcon={<SaveIcon />}
                            onClick={() => handleSave(field.key)}
                            disabled={saving === field.key}
                            className="admin-settings-save"
                          >
                            {saving === field.key ? "..." : "Сохранить"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}