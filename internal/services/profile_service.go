package services

import (
	"os"
	"path/filepath"
)

// ProfileService manages UserSnapshot paths and directories
// Note: This service no longer manages profile index - sessions are handled by keychain
type ProfileService struct {
	baseDir string
}

func NewProfileService(baseDir string) *ProfileService {
	return &ProfileService{baseDir: baseDir}
}

// GetProfilesDir returns the profiles directory path
func (ps *ProfileService) GetProfilesDir() string {
	return filepath.Join(ps.baseDir, "profiles")
}

// GetUserSnapshotPath returns the database path for a user's UserSnapshot
// Format: profiles/{user_id}/pollis.db
func (ps *ProfileService) GetUserSnapshotPath(userID string) string {
	return filepath.Join(ps.GetProfilesDir(), userID, "pollis.db")
}

// GetUserSnapshotDir returns the directory for a user's UserSnapshot
func (ps *ProfileService) GetUserSnapshotDir(userID string) string {
	return filepath.Join(ps.GetProfilesDir(), userID)
}

// UserSnapshotExists checks if a UserSnapshot exists for the given user ID
func (ps *ProfileService) UserSnapshotExists(userID string) bool {
	dbPath := ps.GetUserSnapshotPath(userID)
	_, err := os.Stat(dbPath)
	return err == nil
}

// EnsureUserSnapshotDir creates the directory for a user's UserSnapshot if it doesn't exist
func (ps *ProfileService) EnsureUserSnapshotDir(userID string) error {
	dir := ps.GetUserSnapshotDir(userID)
	return os.MkdirAll(dir, 0700)
}

// DeleteUserSnapshot deletes a user's UserSnapshot directory and all its contents
func (ps *ProfileService) DeleteUserSnapshot(userID string) error {
	dir := ps.GetUserSnapshotDir(userID)
	return os.RemoveAll(dir)
}
