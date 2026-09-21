package services

import (
	"time"
	_ "time/tzdata"
)

const centreTimezone = "Asia/Yekaterinburg"

// CentreLocation is the single calendar timezone used by background jobs.
// It makes their dispatch time independent from the host and container TZ.
func CentreLocation() *time.Location {
	location, err := time.LoadLocation(centreTimezone)
	if err != nil {
		// time/tzdata is embedded, so this is only a defensive fallback.
		return time.FixedZone("UTC+5", 5*60*60)
	}
	return location
}

// CentreDailyDispatchReached reports whether today's local dispatch time has
// already arrived. Callers can use it for one catch-up run after a restart.
func CentreDailyDispatchReached(now time.Time, hour, minute int) bool {
	local := now.In(CentreLocation())
	target := time.Date(local.Year(), local.Month(), local.Day(), hour, minute, 0, 0, local.Location())
	return !local.Before(target)
}

// NextCentreDailyDispatch returns the next strictly future dispatch instant.
func NextCentreDailyDispatch(now time.Time, hour, minute int) time.Time {
	local := now.In(CentreLocation())
	target := time.Date(local.Year(), local.Month(), local.Day(), hour, minute, 0, 0, local.Location())
	if !local.Before(target) {
		target = target.AddDate(0, 0, 1)
	}
	return target
}
