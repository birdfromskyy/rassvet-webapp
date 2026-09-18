package database

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"gorm.io/gorm"
	"sort"
)

//go:embed migrations/reporting/*.sql
var reportingMigrations embed.FS

// MigrateReporting runs additive, checksummed migrations once, transactionally.
// Existing application tables must have been migrated first. No down migration
// is provided: deleting reporting history requires an explicit recovery plan.
func MigrateReporting(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(734129841)").Error; err != nil {
			return err
		}
		if err := tx.Exec(`CREATE TABLE IF NOT EXISTS reporting_schema_migrations (
			version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`).Error; err != nil {
			return err
		}
		entries, err := reportingMigrations.ReadDir("migrations/reporting")
		if err != nil {
			return err
		}
		sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
		for _, entry := range entries {
			data, err := reportingMigrations.ReadFile("migrations/reporting/" + entry.Name())
			if err != nil {
				return err
			}
			checksum := fmt.Sprintf("%x", sha256.Sum256(data))
			var applied []struct{ Checksum string }
			if err := tx.Table("reporting_schema_migrations").Where("version = ?", entry.Name()).Find(&applied).Error; err != nil {
				return err
			}
			if len(applied) > 0 {
				if applied[0].Checksum != checksum {
					return fmt.Errorf("reporting migration %s checksum mismatch", entry.Name())
				}
				continue
			}
			if err := tx.Exec(string(data)).Error; err != nil {
				return fmt.Errorf("reporting migration %s: %w", entry.Name(), err)
			}
			if err := tx.Exec("INSERT INTO reporting_schema_migrations(version,checksum) VALUES (?,?)", entry.Name(), checksum).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
