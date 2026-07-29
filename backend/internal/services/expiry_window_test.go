package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestExpiryReminderDates(t *testing.T) {
	now := time.Date(2026, time.July, 29, 23, 59, 0, 0, time.FixedZone("UTC+6", 6*60*60))
	dates := ExpiryReminderDates(now)

	require.Equal(t, "2026-07-30", dates[0].Format("2006-01-02"))
	require.Equal(t, "2026-08-05", dates[1].Format("2006-01-02"))
	require.Equal(t, now.Location(), dates[0].Location())
	require.Equal(t, now.Location(), dates[1].Location())
}
