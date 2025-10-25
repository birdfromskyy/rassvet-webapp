package services

import (
	"backend/internal/config"
	"fmt"
	"net/smtp"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) SendVerificationCode(to, code string) error {
	from := s.cfg.EmailFrom
	password := s.cfg.EmailPassword

	smtpHost := s.cfg.SMTPHost
	smtpPort := s.cfg.SMTPPort

	message := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: Email Verification Code\r\n"+
			"\r\n"+
			"Your verification code is: %s\r\n"+
			"This code will expire in 15 minutes.",
		from, to, code))

	auth := smtp.PlainAuth("", from, password, smtpHost)

	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{to}, message)
	return err
}
