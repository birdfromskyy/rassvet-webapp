package services

import (
	"backend/internal/config"
	"fmt"
	"log"
	"net/smtp"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) sendMail(to, subject, htmlBody string) error {
	from := s.cfg.EmailFrom
	password := s.cfg.EmailPassword
	smtpHost := s.cfg.SMTPHost
	smtpPort := s.cfg.SMTPPort

	message := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: %s\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n"+
			"\r\n"+
			"%s",
		from, to, subject, htmlBody,
	))

	auth := smtp.PlainAuth("", from, password, smtpHost)
	addr := smtpHost + ":" + smtpPort
	err := smtp.SendMail(addr, auth, from, []string{to}, message)
	if err != nil {
		log.Printf("SMTP send failed: host=%s port=%s from=%s to=%s err=%v", smtpHost, smtpPort, from, to, err)
		return fmt.Errorf("smtp send failed: %w", err)
	}
	return nil
}

func emailLayout(title, preheader, mainContent string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">%s</span>
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#074462;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;letter-spacing:1px;">РАСсвет</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#a8c8dc;">Центр развития детей с задержками развития</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              %s
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#074462;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#a8c8dc;">Это письмо отправлено автоматически — не отвечайте на него.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#6da0bc;">© РАСсвет — Центр социального обслуживания</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, title, preheader, mainContent)
}

func codeBlock(code string) string {
	return fmt.Sprintf(`
<div style="margin:28px 0;text-align:center;">
  <div style="display:inline-block;background-color:#f0f7ff;border:2px dashed #074462;border-radius:12px;padding:20px 40px;">
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Ваш код</p>
    <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:10px;color:#074462;font-family:monospace;">%s</p>
  </div>
</div>`, code)
}

func (s *EmailService) SendVerificationCode(to, code string) error {
	body := emailLayout(
		"Подтверждение почты — РАСсвет",
		"Ваш код подтверждения: "+code,
		fmt.Sprintf(`
<h2 style="margin:0 0 12px;font-size:22px;color:#074462;">Подтверждение электронной почты</h2>
<p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
  Для завершения регистрации или подтверждения нового адреса почты введите этот код на сайте:
</p>
%s
<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;text-align:center;">Код действует <strong>15 минут</strong>. Если вы не запрашивали код — просто проигнорируйте это письмо.</p>
`, codeBlock(code)),
	)
	return s.sendMail(to, "Подтверждение почты — РАСсвет", body)
}

func (s *EmailService) SendPasswordResetCode(to, code string) error {
	body := emailLayout(
		"Сброс пароля — РАСсвет",
		"Ваш код для сброса пароля: "+code,
		fmt.Sprintf(`
<h2 style="margin:0 0 12px;font-size:22px;color:#074462;">Сброс пароля</h2>
<p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
  Мы получили запрос на сброс пароля для вашей учётной записи. Введите этот код на сайте, чтобы продолжить:
</p>
%s
<p style="margin:20px 0 8px;font-size:13px;color:#94a3b8;text-align:center;">Код действует <strong>15 минут</strong>, доступно <strong>5 попыток</strong>.</p>
<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Если вы не запрашивали сброс пароля — ваш аккаунт в безопасности. Просто проигнорируйте это письмо.</p>
`, codeBlock(code)),
	)
	return s.sendMail(to, "Сброс пароля — РАСсвет", body)
}

func (s *EmailService) SendNewPassword(to, newPassword string) error {
	body := emailLayout(
		"Новый пароль — РАСсвет",
		"Ваш новый пароль готов",
		fmt.Sprintf(`
<h2 style="margin:0 0 12px;font-size:22px;color:#074462;">Ваш новый пароль</h2>
<p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
  Ваш пароль был успешно сброшен. Используйте временный пароль ниже для входа:
</p>
<div style="margin:28px 0;text-align:center;">
  <div style="display:inline-block;background-color:#f0f7ff;border:2px dashed #074462;border-radius:12px;padding:20px 40px;">
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Временный пароль</p>
    <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:4px;color:#074462;font-family:monospace;">%s</p>
  </div>
</div>
<div style="background-color:#fff8f0;border-left:4px solid #f59e0b;border-radius:4px;padding:14px 18px;margin-top:20px;">
  <p style="margin:0;font-size:14px;color:#92400e;">
    ⚠️ Рекомендуем сменить пароль сразу после входа в личный кабинет в разделе «Профиль».
  </p>
</div>
`, newPassword),
	)
	return s.sendMail(to, "Новый пароль — РАСсвет", body)
}
