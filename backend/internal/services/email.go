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

func (s *EmailService) sendMail(to, subject, body string) error {
	from := s.cfg.EmailFrom
	password := s.cfg.EmailPassword
	smtpHost := s.cfg.SMTPHost
	smtpPort := s.cfg.SMTPPort

	message := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: %s\r\n"+
			"\r\n"+
			"%s",
		from, to, subject, body,
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

func (s *EmailService) SendVerificationCode(to, code string) error {
	body := fmt.Sprintf(
		"Your verification code is: %s\r\nThis code will expire in 15 minutes.",
		code,
	)
	return s.sendMail(to, "Email Verification Code", body)
}

func (s *EmailService) SendPasswordResetCode(to, code string) error {
	body := fmt.Sprintf(
		"Your password reset code is: %s\r\nThis code will expire in 15 minutes.\r\nYou have 5 attempts to enter the correct code.",
		code,
	)
	return s.sendMail(to, "Password Reset Code", body)
}

func (s *EmailService) SendNewPassword(to, newPassword string) error {
	body := fmt.Sprintf(
		"Your new password is: %s\r\nPlease change it after logging in.",
		newPassword,
	)
	return s.sendMail(to, "Your New Password", body)
}
