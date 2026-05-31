import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  CircularProgress,
  Typography,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { siteSettingService } from "../../services/cmsService";

import "../AdminModule.scss";

const MODULE_TITLE = "Политика персональных данных";
const PUBLIC_PAGE_URL = "/privacy";

const SECTIONS = [
  {
    title: "Реквизиты оператора",
    hint: "Отображаются в разделе 2 публичной страницы /privacy",
    fields: [
      { key: "privacy_operator_name",    label: "Полное наименование организации", multiline: false },
      { key: "privacy_operator_address", label: "Юридический адрес",               multiline: false },
      { key: "privacy_operator_inn",     label: "ИНН / ОГРН",                      multiline: false },
      { key: "privacy_operator_email",   label: "Email организации",                multiline: false },
      { key: "privacy_operator_phone",   label: "Телефон",                          multiline: false },
    ],
  },
  {
    title: "Контакт для запросов о персональных данных",
    hint: "Отображается в разделе 11 — куда писать по вопросам обработки ПДн",
    fields: [
      { key: "privacy_contact_email", label: "Email для запросов субъектов ПДн", multiline: false },
    ],
  },
  {
    title: "Дата актуализации",
    hint: "Отображается в подзаголовке страницы",
    fields: [
      { key: "privacy_policy_updated", label: "Дата актуализации", multiline: false, placeholder: "01 июня 2026 г." },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap(s => s.fields.map(f => f.key));

export default function AdminPrivacyPolicy() {
  const navigate = useNavigate();

  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled(
          ALL_KEYS.map(key => siteSettingService.getByKey(key))
        );
        const loaded = {};
        ALL_KEYS.forEach((key, i) => {
          loaded[key] = results[i].status === "fulfilled" ? (results[i].value?.value || "") : "";
        });
        setValues(loaded);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        ALL_KEYS.map(key => siteSettingService.upsert(key, values[key] || ""))
      );
      toast.success("Настройки политики сохранены");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <main className="admin-module">
      <div className="admin-module__container">

        <section className="admin-module__hero">
          <div>
            <span className="admin-module__badge">CMS</span>
            <h1>{MODULE_TITLE}</h1>
            <p>
              Заполните реквизиты организации — они подставятся в текст
              публичной страницы автоматически.
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
              Перейти на страницу
            </Button>
          </div>
        </section>

        <section className="admin-module__panel">
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SECTIONS.map(section => (
                <Box key={section.title}>
                  <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                    {section.title}
                  </Typography>
                  {section.hint && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {section.hint}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {section.fields.map(field => (
                      <TextField
                        key={field.key}
                        label={field.label}
                        value={values[field.key] || ""}
                        onChange={e => handleChange(field.key, e.target.value)}
                        multiline={field.multiline}
                        rows={field.multiline ? 3 : undefined}
                        placeholder={field.placeholder || ""}
                        fullWidth
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              ))}

              <Box sx={{ pt: 2, borderTop: "1px solid #edf2f7" }}>
                <Button
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="admin-module__button admin-module__button--primary"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
              </Box>
            </Box>
          )}
        </section>

      </div>
    </main>
  );
}
