package models

import (
	"time"

	"gorm.io/gorm"
)

type SupportTicketStatus string
type SupportTicketCategory string

const (
	SupportStatusOpen       SupportTicketStatus = "open"
	SupportStatusInProgress SupportTicketStatus = "in_progress"
	SupportStatusClosed     SupportTicketStatus = "closed"

	SupportCategoryAccount   SupportTicketCategory = "account"
	SupportCategoryDocuments SupportTicketCategory = "documents"
	SupportCategorySchedule  SupportTicketCategory = "schedule"
	SupportCategorySiteError SupportTicketCategory = "site_error"
	SupportCategoryOther     SupportTicketCategory = "other"
)

type SupportTicket struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID   uint                  `gorm:"index;not null" json:"user_id"`
	User     User                  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Subject  string                `gorm:"size:200;not null" json:"subject"`
	Category SupportTicketCategory `gorm:"size:50;not null" json:"category"`
	Status   SupportTicketStatus   `gorm:"size:20;not null;default:'open'" json:"status"`

	Messages []SupportMessage `gorm:"foreignKey:TicketID;constraint:OnDelete:CASCADE" json:"messages,omitempty"`
}

type SupportMessage struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	TicketID     uint   `gorm:"index;not null" json:"ticket_id"`
	SenderID     uint   `gorm:"not null" json:"sender_id"`
	Sender       User   `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Body         string `gorm:"type:text;not null" json:"body"`
	IsAdminReply bool   `gorm:"default:false" json:"is_admin_reply"`

	Attachments []SupportAttachment `gorm:"foreignKey:MessageID;constraint:OnDelete:CASCADE" json:"attachments,omitempty"`
}

type SupportAttachment struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	MessageID    uint   `gorm:"index;not null" json:"message_id"`
	Filename     string `gorm:"size:255;not null" json:"filename"`
	OriginalName string `gorm:"size:255;not null" json:"original_name"`
	FileSize     int64  `json:"file_size"`
}
