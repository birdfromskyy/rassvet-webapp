package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/stretchr/testify/require"
)

type recordingAdminNotificationSender struct {
	ids []uint
}

func (s *recordingAdminNotificationSender) QueueAdminNotification(notificationID uint) {
	s.ids = append(s.ids, notificationID)
}

func TestCreateNotificationRoutesOnlyAdministratorEventsToExternalSender(t *testing.T) {
	env := newTestEnv(t)
	admin := env.seedUser(t, "notification-admin@example.com", "password", "admin", true)
	superadmin := env.seedUser(t, "notification-superadmin@example.com", "password", "superadmin", true)
	parent := env.seedUser(t, "notification-parent@example.com", "password", "user", true)

	sender := &recordingAdminNotificationSender{}
	ConfigureAdminNotificationSender(sender)
	t.Cleanup(func() { ConfigureAdminNotificationSender(nil) })

	require.NoError(t, CreateNotification(env.db, 0, "admin", "Общее событие", "Текст", "/admin/test"))
	require.Len(t, sender.ids, 1, "одно событие не должно дублироваться в VK по числу администраторов")

	var notifications []models.Notification
	require.NoError(t, env.db.Where("title = ?", "Общее событие").Order("user_id ASC").Find(&notifications).Error)
	require.Len(t, notifications, 2)
	require.ElementsMatch(t, []uint{admin.ID, superadmin.ID}, []uint{notifications[0].UserID, notifications[1].UserID})
	require.Contains(t, []uint{notifications[0].ID, notifications[1].ID}, sender.ids[0])

	require.NoError(t, CreateNotification(env.db, parent.ID, "", "Личное событие", "Текст", "/profile"))
	require.Len(t, sender.ids, 1, "личные уведомления не должны отправляться внешним получателям VK")
}
