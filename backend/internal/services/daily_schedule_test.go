package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCentreDailyDispatchUsesYekaterinburgCalendar(t *testing.T) {
	before := time.Date(2026, time.September, 21, 6, 9, 0, 0, time.UTC) // 11:09 UTC+5
	require.False(t, CentreDailyDispatchReached(before, 11, 10))
	require.Equal(t, "2026-09-21 11:10", NextCentreDailyDispatch(before, 11, 10).In(CentreLocation()).Format("2006-01-02 15:04"))

	after := time.Date(2026, time.September, 21, 6, 11, 0, 0, time.UTC) // 11:11 UTC+5
	require.True(t, CentreDailyDispatchReached(after, 11, 10))
	require.Equal(t, "2026-09-22 11:10", NextCentreDailyDispatch(after, 11, 10).In(CentreLocation()).Format("2006-01-02 15:04"))
}
