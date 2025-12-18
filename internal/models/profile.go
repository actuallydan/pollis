package models

// Profile represents a user profile (links Clerk auth to local User)
type Profile struct {
	ID               string `json:"id"`                // Clerk user ID (clerk_id)
	UserID           string `json:"user_id"`          // Local User ID (links to users table)
	AvatarURL        string `json:"avatar_url,omitempty"`
	LastUsedAt       int64  `json:"last_used_at"`
	CreatedAt        int64  `json:"created_at"`
	BiometricEnabled bool   `json:"biometric_enabled"`
}

// ProfileIndex manages multiple profiles on a device
type ProfileIndex struct {
	Profiles       []Profile `json:"profiles"`
	CurrentProfile string    `json:"current_profile,omitempty"` // Profile ID
}


