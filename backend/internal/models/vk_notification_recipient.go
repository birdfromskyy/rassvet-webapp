package models

import "time"

// VKNotificationRecipient is a VK profile that receives copies of
// administrator-wide in-app notifications. It deliberately has no relation to
// User: the recipient list is managed explicitly by administrators.
type VKNotificationRecipient struct {
	ID         uint       `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	VKUserID   int64      `gorm:"uniqueIndex;not null" json:"vk_user_id"`
	ProfileURL string     `gorm:"size:500;not null" json:"profile_url"`
	IsEnabled  bool       `gorm:"default:true;not null" json:"is_enabled"`
	DisabledAt *time.Time `json:"disabled_at"`
}
