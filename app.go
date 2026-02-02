package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pollis/internal/database"
	"pollis/internal/models"
	"pollis/internal/services"
	"pollis/internal/signal"
	"pollis/internal/utils"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed internal/templates/clerk_redirect.html
var clerkRedirectTemplate string

// App struct
type App struct {
	ctx context.Context
	// UserSnapshot management
	profileService  *services.ProfileService
	keychainService *services.KeychainService
	clerkService    *services.ClerkService
	// Auth flow
	authServer *http.Server
	authCancel chan struct{}
	// Databases
	db       *database.DB // Local encrypted DB (messages, keys)
	remoteDB *database.DB // Remote Turso DB (users, groups, channels)
	// Core services
	userService    *services.UserService
	groupService   *services.GroupService
	channelService *services.ChannelService
	messageService *services.MessageService
	dmService      *services.DMService
	queueService   *services.QueueService
	// New auth and crypto services
	authSessionService *services.AuthSessionService
	deviceService      *services.DeviceService
	identityKeyService *services.IdentityKeyService
	prekeyService      *services.PrekeyService
	// Signal protocol services
	signalService        *services.SignalService
	signalSessionService *services.SignalSessionService
	groupKeyService      *services.GroupKeyService
	// Network and external services
	networkService      *services.NetworkService
	serviceClient       *services.ServiceClient // Only for WebRTC signaling, message relay
	queueProcessor      *services.QueueProcessor
	serviceURL          string
	ablyRealtimeService *services.AblyRealtimeService
	r2Service           *services.R2Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Get user data directory
	userDataDir, err := getUserDataDir()
	if err != nil {
		fmt.Printf("Error: failed to get user data directory: %v\n", err)
		return
	}

	// Initialize profile service FIRST
	a.profileService = services.NewProfileService(userDataDir)

	// Initialize keychain service
	a.keychainService, err = services.NewKeychainService()
	if err != nil {
		fmt.Printf("Error: failed to initialize keychain: %v\n", err)
		return
	}

	// Initialize Clerk service (get API key from env or config)
	clerkAPIKey := os.Getenv("CLERK_SECRET_KEY")
	if clerkAPIKey != "" {
		a.clerkService = services.NewClerkService(clerkAPIKey)
	} else {
		fmt.Println("Warning: CLERK_SECRET_KEY not found in environment")
	}

	// Initialize Ably EARLY - before profile loading, so it's always available
	// For MVP: Use static key from environment
	// For production: Can upgrade to token-based auth later
	ablyKey := os.Getenv("ABLY_API_KEY")
	if ablyKey != "" {
		ablyService, err := services.NewAblyRealtimeService(ablyKey)
		if err != nil {
			fmt.Printf("Warning: Failed to initialize Ably: %v\n", err)
		} else {
			a.ablyRealtimeService = ablyService
			fmt.Println("Ably realtime service initialized")
		}
	} else {
		fmt.Println("Info: ABLY_API_KEY not found, Ably realtime features disabled")
	}

	// Initialize R2 service (optional - only if credentials are available)
	r2Service, err := services.NewR2Service()
	if err != nil {
		fmt.Printf("Info: R2 service not available: %v\n", err)
	} else {
		a.r2Service = r2Service
		fmt.Println("R2 service initialized")
	}

	// Initialize direct Turso connection for remote data (users, groups, channels)
	tursoURL := os.Getenv("TURSO_URL")
	tursoToken := os.Getenv("TURSO_TOKEN")
	if tursoURL != "" && tursoToken != "" {
		// Build Turso connection string
		if !strings.Contains(tursoURL, "authToken=") {
			sep := "?"
			if strings.Contains(tursoURL, "?") {
				sep = "&"
			}
			tursoURL = fmt.Sprintf("%s%sauthToken=%s", tursoURL, sep, tursoToken)
		}

		remoteDB, err := database.NewRemoteDB(tursoURL)
		if err != nil {
			fmt.Printf("Warning: Failed to connect to Turso: %v\n", err)
		} else {
			a.remoteDB = remoteDB
			fmt.Println("✓ Connected to Turso directly (no gRPC middleman)")
		}
	} else {
		fmt.Println("Warning: TURSO_URL or TURSO_TOKEN not set, remote DB features disabled")
	}

	// Initialize network service (needed before service client)
	a.networkService = services.NewNetworkService()
	a.networkService.StartMonitoring()

	// Initialize service client from environment variable
	serviceURL := os.Getenv("VITE_SERVICE_URL")
	if serviceURL == "" {
		serviceURL = "localhost:50051" // Default
	}
	if err := a.SetServiceURL(serviceURL); err != nil {
		fmt.Printf("Warning: Failed to initialize service client: %v (app will work offline)\n", err)
	} else {
		fmt.Printf("Service client initialized: %s\n", serviceURL)
	}

	// Check for stored session
	fmt.Println("Checking for stored session...")
	userID, clerkToken, err := a.keychainService.GetStoredSession()
	if err != nil {
		fmt.Printf("GetStoredSession error: %v\n", err)
	} else {
		fmt.Printf("GetStoredSession success - userID: %s, token length: %d\n", userID, len(clerkToken))
	}

	if err == nil && userID != "" && clerkToken != "" {
		// Session exists locally - trust it without calling Clerk
		fmt.Printf("Found stored session for user: %s\n", userID)
		if err := a.loadUserSnapshot(userID); err == nil {
			// UserSnapshot loaded successfully
			fmt.Println("UserSnapshot loaded successfully")
			return
		} else {
			fmt.Printf("Failed to load UserSnapshot: %v\n", err)
			// Clear session if user database can't be loaded
			fmt.Println("Clearing session due to failed UserSnapshot load")
			a.keychainService.ClearSession()
		}
	}

	// No session or invalid, app will show auth screen (handled by frontend)
	fmt.Println("No valid session found, showing auth screen")
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	a.saveWindowBounds()
}

// saveWindowBounds saves current window size and position to database
func (a *App) saveWindowBounds() {
	if a.db == nil {
		return
	}

	width, height := runtime.WindowGetSize(a.ctx)
	x, y := runtime.WindowGetPosition(a.ctx)

	// Store as JSON in key_value table
	bounds := fmt.Sprintf(`{"width":%d,"height":%d,"x":%d,"y":%d}`, width, height, x, y)

	_, err := a.db.GetConn().Exec(
		`INSERT OR REPLACE INTO key_value (key, value) VALUES ('window_bounds', ?)`,
		bounds,
	)
	if err != nil {
		fmt.Printf("Failed to save window bounds: %v\n", err)
	}
}

// restoreWindowBounds restores window size and position from database
func (a *App) restoreWindowBounds() {
	if a.db == nil {
		return
	}

	// Get screen size to calculate sensible defaults
	screens, err := runtime.ScreenGetAll(a.ctx)
	if err != nil || len(screens) == 0 {
		return
	}
	screen := screens[0] // Primary screen

	// Sensible defaults: max 1280x720, or 80% of screen (whichever is smaller)
	maxWidth := min(1280, int(float64(screen.Width)*0.8))
	maxHeight := min(720, int(float64(screen.Height)*0.8))

	// Try to load saved bounds
	var bounds string
	err = a.db.GetConn().QueryRow(`SELECT value FROM key_value WHERE key = 'window_bounds'`).Scan(&bounds)
	if err != nil {
		// No saved bounds - use defaults and center
		x := (screen.Width - maxWidth) / 2
		y := (screen.Height - maxHeight) / 2
		runtime.WindowSetSize(a.ctx, maxWidth, maxHeight)
		runtime.WindowSetPosition(a.ctx, x, y)
		return
	}

	// Parse saved bounds
	var width, height, x, y int
	_, err = fmt.Sscanf(bounds, `{"width":%d,"height":%d,"x":%d,"y":%d}`, &width, &height, &x, &y)
	if err != nil {
		return
	}

	// Validate bounds are still on screen and reasonable
	if width < 300 || height < 600 || width > screen.Width || height > screen.Height ||
		x < 0 || y < 0 || x+width > screen.Width || y+height > screen.Height {
		// Invalid bounds - use defaults
		x = (screen.Width - maxWidth) / 2
		y = (screen.Height - maxHeight) / 2
		runtime.WindowSetSize(a.ctx, maxWidth, maxHeight)
		runtime.WindowSetPosition(a.ctx, x, y)
		return
	}

	// Saved bounds are valid - use them
	runtime.WindowSetSize(a.ctx, width, height)
	runtime.WindowSetPosition(a.ctx, x, y)
}

// Helper function to load a user's UserSnapshot database
// If loading fails, creates a new snapshot and keeps the old one
func (a *App) loadUserSnapshot(userID string) error {
	fmt.Println("  Getting encryption key from keychain...")
	// Get encryption key from keychain (stored with userID as key)
	encryptionKey, err := a.keychainService.GetEncryptionKey(userID)
	if err != nil {
		return fmt.Errorf("failed to get encryption key: %w", err)
	}
	fmt.Println("  Got encryption key")

	// Get the standard database path
	standardPath := a.profileService.GetUserSnapshotPath(userID)

	// Try to find the newest UserSnapshot for this user
	// UserSnapshots are stored at: profiles/{user_id}/pollis.db
	// If multiple exist (e.g., from failed migrations), we want the newest one
	dbPath, err := a.findNewestUserSnapshot(userID)
	if err != nil {
		// No existing snapshot found, create new one
		fmt.Printf("  No existing UserSnapshot found, creating new one at: %s\n", standardPath)

		// Ensure directory exists
		if err := a.profileService.EnsureUserSnapshotDir(userID); err != nil {
			return fmt.Errorf("failed to create UserSnapshot directory: %w", err)
		}

		// Create new database
		db, err := database.NewEncryptedDB(standardPath, encryptionKey)
		if err != nil {
			return fmt.Errorf("failed to create database: %w", err)
		}
		a.db = db
		fmt.Printf("  Created new UserSnapshot at: %s\n", standardPath)
	} else {
		// Found existing snapshot, try to load it
		fmt.Printf("  Found UserSnapshot at: %s\n", dbPath)
		db, err := database.NewEncryptedDB(dbPath, encryptionKey)
		if err != nil {
			// Loading failed - create a new snapshot and keep the old one
			fmt.Printf("  Failed to load UserSnapshot at %s: %v\n", dbPath, err)
			fmt.Println("  Creating new UserSnapshot and keeping old one...")

			// Rename old snapshot if it exists and is the standard path
			if dbPath == standardPath {
				// It's the standard file, rename it to backup
				backupPath := dbPath + ".backup." + fmt.Sprintf("%d", time.Now().Unix())
				if err := os.Rename(dbPath, backupPath); err == nil {
					fmt.Printf("  Renamed old UserSnapshot to: %s\n", backupPath)
				}
			} else {
				// It's already a backup file, leave it as-is
				fmt.Printf("  Keeping backup file: %s\n", dbPath)
			}

			// Create new snapshot at standard path
			if err := a.profileService.EnsureUserSnapshotDir(userID); err != nil {
				return fmt.Errorf("failed to create UserSnapshot directory: %w", err)
			}
			db, err = database.NewEncryptedDB(standardPath, encryptionKey)
			if err != nil {
				return fmt.Errorf("failed to create new database: %w", err)
			}
			a.db = db
			fmt.Printf("  Created new UserSnapshot at: %s\n", standardPath)
		} else {
			a.db = db
			fmt.Println("  Database opened successfully")
		}
	}

	// Initialize all services with the new database connection
	conn := a.db.GetConn()

	// Core services
	a.userService = services.NewUserService(conn)
	a.groupService = services.NewGroupService(conn)
	a.channelService = services.NewChannelService(conn)
	a.messageService = services.NewMessageService(conn)
	a.dmService = services.NewDMService(conn)
	a.queueService = services.NewQueueService(conn)

	// New auth and crypto services
	a.authSessionService = services.NewAuthSessionService(conn)
	a.deviceService = services.NewDeviceService(conn)
	a.identityKeyService = services.NewIdentityKeyService(conn)
	a.prekeyService = services.NewPrekeyService(conn)

	// Signal protocol services
	a.signalSessionService = services.NewSignalSessionService(conn)
	a.groupKeyService = services.NewGroupKeyService(conn)
	a.signalService = services.NewSignalService(a.signalSessionService, a.groupKeyService)

	// Network service is initialized in startup() before service client
	// Only create if not already initialized
	if a.networkService == nil {
		a.networkService = services.NewNetworkService()
	}

	// Restore window bounds now that database is loaded
	a.restoreWindowBounds()

	return nil
}

// findNewestUserSnapshot finds the newest UserSnapshot for a user
// Returns the path to the newest snapshot, or error if none found
// Also handles migration from old noise.db to pollis.db
func (a *App) findNewestUserSnapshot(userID string) (string, error) {
	// Check if the standard path exists
	standardPath := a.profileService.GetUserSnapshotPath(userID)
	if _, err := os.Stat(standardPath); err == nil {
		return standardPath, nil
	}

	// Look for backup files (pollis.db.backup.*) or old files (noise.db*) in the user's snapshot directory
	dir := filepath.Dir(standardPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("failed to read directory: %w", err)
	}

	var newestPath string
	var newestTime time.Time
	var oldNoiseDbPath string

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		filePath := filepath.Join(dir, name)
		info, err := entry.Info()
		if err != nil {
			continue
		}

		modTime := info.ModTime()

		// Check if it's a pollis.db file (standard or backup)
		if name == "pollis.db" || strings.HasPrefix(name, "pollis.db.backup.") {
			if newestPath == "" || modTime.After(newestTime) {
				newestPath = filePath
				newestTime = modTime
			}
		} else if name == "noise.db" || strings.HasPrefix(name, "noise.db.backup.") {
			// Found old noise.db file - remember it for migration
			if oldNoiseDbPath == "" || modTime.After(newestTime) {
				oldNoiseDbPath = filePath
				if newestTime.IsZero() || modTime.After(newestTime) {
					newestTime = modTime
				}
			}
		}
	}

	// If we found an old noise.db but no pollis.db, migrate it
	if oldNoiseDbPath != "" && newestPath == "" {
		fmt.Printf("  Found old database file (noise.db), migrating to pollis.db...\n")
		// Rename old noise.db to pollis.db
		if err := os.Rename(oldNoiseDbPath, standardPath); err == nil {
			fmt.Printf("  Migrated %s to %s\n", oldNoiseDbPath, standardPath)
			return standardPath, nil
		} else {
			fmt.Printf("  Warning: failed to migrate old database: %v\n", err)
			// Return the old path anyway, it will work
			return oldNoiseDbPath, nil
		}
	}

	if newestPath == "" {
		return "", fmt.Errorf("no UserSnapshot found")
	}

	return newestPath, nil
}

// getUserDataDir returns the user data directory for the app
func getUserDataDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	// Platform-specific data directories
	var dataDir string
	switch {
	case os.Getenv("XDG_DATA_HOME") != "":
		dataDir = filepath.Join(os.Getenv("XDG_DATA_HOME"), "pollis")
	case os.Getenv("APPDATA") != "":
		// Windows
		dataDir = filepath.Join(os.Getenv("APPDATA"), "Pollis")
	case os.Getenv("HOME") != "":
		// macOS/Linux
		dataDir = filepath.Join(homeDir, ".local", "share", "pollis")
	default:
		dataDir = filepath.Join(homeDir, ".pollis")
	}

	return dataDir, nil
}

// Greet returns a greeting for the given name (kept for compatibility)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// CheckIdentity checks if the current user has created their user identity
func (a *App) CheckIdentity() (bool, error) {
	// Check if database is loaded
	if a.db == nil {
		return false, nil
	}

	// Check if user exists in the database
	var count int
	err := a.db.GetConn().QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check identity: %w", err)
	}

	return count > 0, nil
}

// GetNetworkStatus returns the current network status
func (a *App) GetNetworkStatus() (string, error) {
	return a.networkService.GetStatus(), nil
}

// SetKillSwitch sets the network kill-switch state
func (a *App) SetKillSwitch(enabled bool) error {
	a.networkService.SetKillSwitch(enabled)
	return nil
}

// SetServiceURL sets the gRPC service URL and initializes the client
func (a *App) SetServiceURL(url string) error {
	if a.serviceClient != nil {
		_ = a.serviceClient.Close()
	}

	client, err := services.NewServiceClient(url)
	if err != nil {
		return fmt.Errorf("failed to create service client: %w", err)
	}

	a.serviceClient = client
	a.serviceURL = url

	// Initialize queue processor
	a.queueProcessor = services.NewQueueProcessor(
		a.queueService,
		a.messageService,
		a.serviceClient,
		a.networkService,
		a.signalService,
	)
	a.queueProcessor.Start()

	return nil
}

// ========== User Service Methods ==========

// CreateUser creates a new user identity (legacy method - use AuthenticateAndLoadUser instead)
// This method is deprecated - users should be created via Clerk authentication
func (a *App) CreateUser(username, email, phone string) (*models.User, error) {
	return nil, fmt.Errorf("CreateUser is deprecated - use AuthenticateAndLoadUser with Clerk authentication instead")
}

// GetCurrentUser gets the current user (first user in database)
func (a *App) GetCurrentUser() (*models.User, error) {
	if a.userService == nil {
		return nil, fmt.Errorf("user service not initialized")
	}

	users, err := a.userService.ListUsers()
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	if len(users) == 0 {
		return nil, fmt.Errorf("no user found - please create an identity first")
	}

	// Return the first user (in future, could support multiple identities)
	user := users[0]

	// Decrypt keys (in production, use master key from keychain)
	// For MVP, we'll need to decrypt them when needed
	// TODO: Implement proper key decryption with master key from keychain

	return user, nil
}

// GetUserByIdentifier gets a user by username, email, or phone
func (a *App) GetUserByIdentifier(identifier string) (*models.User, error) {
	if identifier == "" {
		return nil, fmt.Errorf("identifier cannot be empty")
	}
	user, err := a.userService.GetUserByIdentifier(identifier)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return user, nil
}

// UpdateUser updates user information
func (a *App) UpdateUser(user *models.User) error {
	if user == nil {
		return fmt.Errorf("user cannot be nil")
	}
	if user.ID == "" {
		return fmt.Errorf("user ID is required")
	}
	if err := a.userService.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

// GetServiceUserData gets user data (username, email, phone, avatar_url) from Turso DB directly
func (a *App) GetServiceUserData() (map[string]interface{}, error) {
	currentUser, err := a.GetCurrentUser()
	if err != nil || currentUser == nil {
		return nil, fmt.Errorf("no current user found")
	}

	// Query Turso directly (no gRPC middleman)
	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query user from Turso by clerk_id using direct SQL
	var username, email, phone, avatarURL sql.NullString
	err = a.remoteDB.GetConn().QueryRow(`
		SELECT username, email, phone, avatar_url
		FROM users
		WHERE clerk_id = ?
	`, currentUser.ClerkID).Scan(&username, &email, &phone, &avatarURL)

	if err != nil {
		if err == sql.ErrNoRows {
			// User not found, return empty
			return map[string]interface{}{
				"username":   "",
				"email":      "",
				"phone":      "",
				"avatar_url": "",
			}, nil
		}
		return nil, fmt.Errorf("failed to query user from Turso: %w", err)
	}

	result := map[string]interface{}{
		"username":   "",
		"email":      "",
		"phone":      "",
		"avatar_url": "",
	}

	if username.Valid && username.String != "" {
		result["username"] = username.String
	}
	if email.Valid && email.String != "" {
		result["email"] = email.String
	}
	if phone.Valid && phone.String != "" {
		result["phone"] = phone.String
	}
	if avatarURL.Valid && avatarURL.String != "" {
		result["avatar_url"] = avatarURL.String
	}

	return result, nil
}

// UpdateServiceUserData updates user data in Turso DB directly
func (a *App) UpdateServiceUserData(username string, email, phone, avatarURL *string) error {
	currentUser, err := a.GetCurrentUser()
	if err != nil || currentUser == nil {
		return fmt.Errorf("no current user found")
	}

	if a.remoteDB == nil {
		return fmt.Errorf("remote database not initialized")
	}

	clerkID := currentUser.ClerkID
	now := time.Now().Unix()

	// Check if user exists in Turso by clerk_id
	var existingUserID string
	err = a.remoteDB.GetConn().QueryRow("SELECT id FROM users WHERE clerk_id = ?", clerkID).Scan(&existingUserID)

	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if err == sql.ErrNoRows {
		// User doesn't exist - insert new user
		_, err = a.remoteDB.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, avatar_url, created_at, disabled)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0)
		`, currentUser.ID, clerkID, username, email, phone, avatarURL, now)
		if err != nil {
			return fmt.Errorf("failed to insert user in Turso: %w", err)
		}
		fmt.Printf("✓ Created user in Turso (direct connection)\n")
	} else {
		// User exists - update with provided fields
		query := "UPDATE users SET username = ?, email = ?, phone = ?"
		args := []interface{}{username, email, phone}

		if avatarURL != nil {
			query += ", avatar_url = ?"
			args = append(args, *avatarURL)
		}

		query += " WHERE clerk_id = ?"
		args = append(args, clerkID)

		_, err = a.remoteDB.GetConn().Exec(query, args...)
		if err != nil {
			return fmt.Errorf("failed to update user in Turso: %w", err)
		}
		fmt.Printf("✓ Updated user data in Turso (direct connection)\n")
	}

	return nil
}

// UpdateServiceUserAvatar updates user avatar URL in Turso DB directly
func (a *App) UpdateServiceUserAvatar(avatarURL string) error {
	currentUser, err := a.GetCurrentUser()
	if err != nil || currentUser == nil {
		return fmt.Errorf("no current user found")
	}

	if a.remoteDB == nil {
		return fmt.Errorf("remote database not initialized")
	}

	clerkID := currentUser.ClerkID
	now := time.Now().Unix()

	// Check if user exists in Turso by clerk_id
	var existingUserID string
	err = a.remoteDB.GetConn().QueryRow("SELECT id FROM users WHERE clerk_id = ?", clerkID).Scan(&existingUserID)

	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if err == sql.ErrNoRows {
		// User doesn't exist - insert new user with avatar
		_, err = a.remoteDB.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, avatar_url, created_at, disabled)
			VALUES (?, ?, NULL, NULL, NULL, ?, ?, 0)
		`, currentUser.ID, clerkID, avatarURL, now)
		if err != nil {
			return fmt.Errorf("failed to insert user in Turso: %w", err)
		}
		fmt.Printf("✓ Created user with avatar in Turso: %s (direct connection)\n", avatarURL)
	} else {
		// User exists - update avatar_url only
		_, err = a.remoteDB.GetConn().Exec("UPDATE users SET avatar_url = ? WHERE clerk_id = ?", avatarURL, clerkID)
		if err != nil {
			return fmt.Errorf("failed to update avatar in Turso: %w", err)
		}
		fmt.Printf("✓ Avatar URL updated in Turso: %s (direct connection)\n", avatarURL)
	}

	return nil
}

// deriveSlugFromName generates a URL-safe slug from a name (same logic as frontend)
func deriveSlugFromName(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	// Remove invalid characters (keep only alphanumeric and hyphens)
	var result strings.Builder
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result.WriteRune(r)
		}
	}
	slug = result.String()
	// Replace multiple hyphens with single
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")
	return slug
}

// ========== Group Service Methods ==========

// UpdateGroup updates group information (name, slug, description)
func (a *App) UpdateGroup(groupID, name, description string) (*models.Group, error) {
	if groupID == "" {
		return nil, fmt.Errorf("group_id is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	// Get existing group from Turso
	group, err := a.GetGroup(groupID)
	if err != nil {
		return nil, fmt.Errorf("group not found: %w", err)
	}

	// Generate new slug from name (using same logic as frontend)
	newSlug := deriveSlugFromName(name)

	// Check if slug changed and if new slug conflicts with existing group
	if newSlug != group.Slug {
		existing, err := a.GetGroupBySlug(newSlug)
		if err == nil && existing != nil && existing.ID != groupID {
			return nil, fmt.Errorf("group with slug '%s' already exists", newSlug)
		}
		group.Slug = newSlug
	}

	// Update group fields
	group.Name = name
	if description != "" {
		group.Description = description
	} else {
		group.Description = ""
	}
	group.UpdatedAt = time.Now().Unix()

	// Update in Turso
	if a.remoteDB != nil {
		_, err := a.remoteDB.GetConn().Exec(`
			UPDATE groups
			SET slug = ?, name = ?, description = ?, updated_at = ?
			WHERE id = ?
		`, group.Slug, group.Name, group.Description, group.UpdatedAt, group.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to update group in Turso: %w", err)
		}
		fmt.Printf("✓ Group updated in Turso: %s\n", group.Slug)
	} else {
		return nil, fmt.Errorf("remote database not initialized")
	}

	return group, nil
}

// CreateGroup creates a new group
func (a *App) CreateGroup(slug, name, description, createdBy string) (*models.Group, error) {
	fmt.Printf("[CreateGroup] Starting: slug=%s, name=%s, createdBy=%s\n", slug, name, createdBy)

	// Validate input
	if slug == "" {
		fmt.Printf("[CreateGroup] ERROR: slug is empty\n")
		return nil, fmt.Errorf("slug is required")
	}
	if name == "" {
		fmt.Printf("[CreateGroup] ERROR: name is empty\n")
		return nil, fmt.Errorf("name is required")
	}
	if createdBy == "" {
		fmt.Printf("[CreateGroup] ERROR: createdBy is empty\n")
		return nil, fmt.Errorf("created_by is required")
	}

	// Check if group with slug already exists in Turso
	fmt.Printf("[CreateGroup] Checking if group '%s' already exists...\n", slug)
	existing, err := a.GetGroupBySlug(slug)
	if err != nil {
		// Error is expected if group doesn't exist
		fmt.Printf("[CreateGroup] GetGroupBySlug returned error (expected if doesn't exist): %v\n", err)
	}
	if err == nil && existing != nil {
		fmt.Printf("[CreateGroup] ERROR: Group with slug '%s' already exists\n", slug)
		return nil, fmt.Errorf("group with slug '%s' already exists", slug)
	}

	if a.remoteDB == nil {
		fmt.Printf("[CreateGroup] ERROR: remoteDB is nil\n")
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Ensure the creator user exists in Turso (required for foreign key constraint)
	// We need to check by clerk_id because the user ID in Turso might differ from local
	fmt.Printf("[CreateGroup] Checking if creator user exists in Turso...\n")

	// Get local user info to get clerk_id
	localUser, err := a.GetCurrentUser()
	if err != nil || localUser == nil || localUser.ID != createdBy {
		fmt.Printf("[CreateGroup] ERROR: Could not get local user info: %v\n", err)
		return nil, fmt.Errorf("creator user not found in local database")
	}

	// Check if user exists in Turso by clerk_id and get their Turso ID
	var tursoUserID string
	err = a.remoteDB.GetConn().QueryRow(`SELECT id FROM users WHERE clerk_id = ?`, localUser.ClerkID).Scan(&tursoUserID)

	if err == sql.ErrNoRows {
		// User doesn't exist in Turso, create them with the local ID
		fmt.Printf("[CreateGroup] User does not exist in Turso, creating user record...\n")
		now := time.Now().Unix()
		_, err = a.remoteDB.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, created_at, disabled)
			VALUES (?, ?, NULL, NULL, NULL, ?, 0)
		`, localUser.ID, localUser.ClerkID, now)
		if err != nil {
			fmt.Printf("[CreateGroup] ERROR: Failed to create user in Turso: %v\n", err)
			return nil, fmt.Errorf("failed to create user in Turso: %w", err)
		}
		fmt.Printf("✓ User created in Turso: %s (clerk_id: %s)\n", localUser.ID, localUser.ClerkID)
		tursoUserID = localUser.ID // Use the local ID we just inserted
	} else if err != nil {
		fmt.Printf("[CreateGroup] ERROR: Failed to check if user exists: %v\n", err)
		return nil, fmt.Errorf("failed to verify user exists in Turso: %w", err)
	} else {
		fmt.Printf("[CreateGroup] User exists in Turso with ID: %s\n", tursoUserID)
		if tursoUserID != localUser.ID {
			fmt.Printf("[CreateGroup] WARNING: Turso user ID (%s) differs from local ID (%s)\n", tursoUserID, localUser.ID)
		}
	}

	// Use the Turso user ID for the foreign key (not the local user ID)
	createdBy = tursoUserID

	// Generate group ID
	groupID := utils.NewULID()
	now := time.Now().Unix()
	fmt.Printf("[CreateGroup] Generated ID: %s\n", groupID)

	// Create group directly in Turso
	fmt.Printf("[CreateGroup] Inserting group into Turso...\n")
	_, err = a.remoteDB.GetConn().Exec(`
		INSERT INTO groups (id, slug, name, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, groupID, slug, name, description, createdBy, now, now)
	if err != nil {
		fmt.Printf("[CreateGroup] ERROR: Failed to insert group: %v\n", err)
		return nil, fmt.Errorf("failed to create group in Turso: %w", err)
	}
	fmt.Printf("✓ Group created in Turso: %s (id: %s)\n", slug, groupID)

	// Add creator as member in Turso
	fmt.Printf("[CreateGroup] Adding creator as member...\n")
	_, err = a.remoteDB.GetConn().Exec(`
		INSERT INTO group_member (group_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?)
	`, groupID, createdBy, "owner", now)
	if err != nil {
		fmt.Printf("[CreateGroup] ERROR: Failed to add creator as member: %v\n", err)
		return nil, fmt.Errorf("failed to add creator as member in Turso: %w", err)
	}
	fmt.Printf("✓ Creator added as owner in Turso\n")

	group := &models.Group{
		ID:          groupID,
		Slug:        slug,
		Name:        name,
		Description: description,
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	fmt.Printf("[CreateGroup] SUCCESS: Group created successfully\n")
	return group, nil
}

// GetGroup gets a group by ID
func (a *App) GetGroup(groupID string) (*models.Group, error) {
	if groupID == "" {
		return nil, fmt.Errorf("group_id is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	group := &models.Group{}
	var description sql.NullString
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE id = ?
	`, groupID).Scan(&group.ID, &group.Slug, &group.Name, &description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to query group from Turso: %w", err)
	}

	// Handle NULL description
	if description.Valid {
		group.Description = description.String
	} else {
		group.Description = ""
	}

	return group, nil
}

// GetGroupBySlug gets a group by slug
func (a *App) GetGroupBySlug(slug string) (*models.Group, error) {
	if slug == "" {
		return nil, fmt.Errorf("slug is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	group := &models.Group{}
	var description sql.NullString
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE slug = ?
	`, slug).Scan(&group.ID, &group.Slug, &group.Name, &description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to query group from Turso: %w", err)
	}

	// Handle NULL description
	if description.Valid {
		group.Description = description.String
	} else {
		group.Description = ""
	}

	return group, nil
}

// ListUserGroups lists all groups for a user
func (a *App) ListUserGroups(userIdentifier string) ([]*models.Group, error) {
	fmt.Printf("[ListUserGroups] Called with userIdentifier: %s\n", userIdentifier)

	if userIdentifier == "" {
		return nil, fmt.Errorf("user_identifier is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Get local user to find their clerk_id
	localUser, err := a.GetCurrentUser()
	if err != nil || localUser == nil {
		fmt.Printf("[ListUserGroups] ERROR: Failed to get current user: %v\n", err)
		return nil, fmt.Errorf("failed to get current user: %w", err)
	}
	fmt.Printf("[ListUserGroups] Local user: ID=%s, ClerkID=%s\n", localUser.ID, localUser.ClerkID)

	// Resolve the Turso user ID by clerk_id (might differ from local ID)
	var tursoUserID string
	err = a.remoteDB.GetConn().QueryRow(`SELECT id FROM users WHERE clerk_id = ?`, localUser.ClerkID).Scan(&tursoUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			// User doesn't exist in Turso yet, return empty list
			fmt.Printf("[ListUserGroups] User not found in Turso by clerk_id: %s\n", localUser.ClerkID)
			return []*models.Group{}, nil
		}
		fmt.Printf("[ListUserGroups] ERROR: Failed to get Turso user ID: %v\n", err)
		return nil, fmt.Errorf("failed to get Turso user ID: %w", err)
	}
	fmt.Printf("[ListUserGroups] Turso user ID: %s (local was: %s)\n", tursoUserID, localUser.ID)

	// Query Turso directly for groups where user is a member (using Turso user ID)
	rows, err := a.remoteDB.GetConn().Query(`
		SELECT g.id, g.slug, g.name, g.description, g.created_by, g.created_at, g.updated_at
		FROM groups g
		INNER JOIN group_member gm ON g.id = gm.group_id
		WHERE gm.user_id = ?
		ORDER BY g.created_at DESC
	`, tursoUserID)
	if err != nil {
		fmt.Printf("[ListUserGroups] ERROR: Query failed: %v\n", err)
		return nil, fmt.Errorf("failed to query groups from Turso: %w", err)
	}
	defer rows.Close()

	var groups []*models.Group
	for rows.Next() {
		group := &models.Group{}
		var description sql.NullString
		err := rows.Scan(&group.ID, &group.Slug, &group.Name, &description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt)
		if err != nil {
			fmt.Printf("[ListUserGroups] ERROR: Scan failed: %v\n", err)
			return nil, fmt.Errorf("failed to scan group: %w", err)
		}
		// Handle NULL description
		if description.Valid {
			group.Description = description.String
		} else {
			group.Description = ""
		}
		groups = append(groups, group)
	}

	fmt.Printf("[ListUserGroups] Found %d groups\n", len(groups))
	return groups, rows.Err()
}

// AddGroupMember adds a member to a group
func (a *App) AddGroupMember(groupID, userIdentifier string) error {
	if groupID == "" {
		return fmt.Errorf("group_id is required")
	}
	if userIdentifier == "" {
		return fmt.Errorf("user_identifier is required")
	}

	// Check if group exists in Turso
	_, err := a.GetGroup(groupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	if a.remoteDB == nil {
		return fmt.Errorf("remote database not initialized")
	}

	// Check if already a member in Turso
	var count int
	err = a.remoteDB.GetConn().QueryRow(`
		SELECT COUNT(*)
		FROM group_member
		WHERE group_id = ? AND user_id = ?
	`, groupID, userIdentifier).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check membership in Turso: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("user is already a member of this group")
	}

	// Add member directly to Turso
	now := time.Now().Unix()
	_, err = a.remoteDB.GetConn().Exec(`
		INSERT INTO group_member (group_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?)
	`, groupID, userIdentifier, "member", now)
	if err != nil {
		return fmt.Errorf("failed to add group member to Turso: %w", err)
	}
	fmt.Printf("✓ Group member added to Turso\n")

	return nil
}

// ListGroupMembers lists all members of a group
func (a *App) ListGroupMembers(groupID string) ([]*models.GroupMember, error) {
	if groupID == "" {
		return nil, fmt.Errorf("group_id is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly (using group_member table - singular)
	rows, err := a.remoteDB.GetConn().Query(`
		SELECT group_id, user_id, joined_at
		FROM group_member
		WHERE group_id = ?
		ORDER BY joined_at DESC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query group members from Turso: %w", err)
	}
	defer rows.Close()

	var members []*models.GroupMember
	for rows.Next() {
		member := &models.GroupMember{}
		var userID string
		err := rows.Scan(&member.GroupID, &userID, &member.JoinedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group member: %w", err)
		}
		// Map user_id to UserIdentifier for backward compatibility with GroupMember model
		member.UserIdentifier = userID
		members = append(members, member)
	}

	return members, rows.Err()
}

// ========== Channel Service Methods ==========

// CreateChannel creates a new channel
func (a *App) CreateChannel(groupID, slug, name, description, createdBy string) (*models.Channel, error) {
	// Validate input
	if groupID == "" {
		return nil, fmt.Errorf("group_id is required")
	}
	if slug == "" {
		return nil, fmt.Errorf("slug is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if createdBy == "" {
		return nil, fmt.Errorf("created_by is required")
	}

	// Verify group exists in Turso
	_, err := a.GetGroup(groupID)
	if err != nil {
		return nil, fmt.Errorf("group not found: %w", err)
	}

	// Check if channel with this slug already exists in the group
	exists, err := a.ChannelExistsBySlug(groupID, slug)
	if err != nil {
		return nil, fmt.Errorf("failed to check channel existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("channel with slug '%s' already exists in this group", slug)
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Resolve the Turso user ID (might differ from local ID) for foreign key
	localUser, err := a.GetCurrentUser()
	if err != nil || localUser == nil || localUser.ID != createdBy {
		return nil, fmt.Errorf("creator user not found in local database")
	}

	// Get Turso user ID by clerk_id
	var tursoUserID string
	err = a.remoteDB.GetConn().QueryRow(`SELECT id FROM users WHERE clerk_id = ?`, localUser.ClerkID).Scan(&tursoUserID)
	if err == sql.ErrNoRows {
		// User doesn't exist in Turso, create them
		now := time.Now().Unix()
		_, err = a.remoteDB.GetConn().Exec(`
			INSERT INTO users (id, clerk_id, username, email, phone, created_at, disabled)
			VALUES (?, ?, NULL, NULL, NULL, ?, 0)
		`, localUser.ID, localUser.ClerkID, now)
		if err != nil {
			return nil, fmt.Errorf("failed to create user in Turso: %w", err)
		}
		tursoUserID = localUser.ID
	} else if err != nil {
		return nil, fmt.Errorf("failed to get Turso user ID: %w", err)
	}

	// Use Turso user ID for the foreign key
	createdBy = tursoUserID

	// Generate channel ID
	channelID := utils.NewULID()
	now := time.Now().Unix()

	// Create channel directly in Turso (note: table is 'channel' singular)
	_, err = a.remoteDB.GetConn().Exec(`
		INSERT INTO channel (id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, channelID, groupID, slug, name, description, "text", createdBy, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create channel in Turso: %w", err)
	}
	fmt.Printf("✓ Channel created in Turso: %s (id: %s)\n", slug, channelID)

	channel := &models.Channel{
		ID:          channelID,
		GroupID:     groupID,
		Slug:        slug,
		Name:        name,
		Description: description,
		CreatedBy:   createdBy,
		ChannelType: "text",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	return channel, nil
}

// GetChannel gets a channel by ID
func (a *App) GetChannel(channelID string) (*models.Channel, error) {
	if channelID == "" {
		return nil, fmt.Errorf("channel_id is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	channel := &models.Channel{}
	var description sql.NullString
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channel
		WHERE id = ?
	`, channelID).Scan(&channel.ID, &channel.GroupID, &channel.Slug, &channel.Name, &description, &channel.ChannelType, &channel.CreatedBy, &channel.CreatedAt, &channel.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, fmt.Errorf("failed to query channel from Turso: %w", err)
	}

	// Handle NULL description
	if description.Valid {
		channel.Description = description.String
	} else {
		channel.Description = ""
	}

	return channel, nil
}

// ListChannels lists all channels in a group
func (a *App) ListChannels(groupID string) ([]*models.Channel, error) {
	if groupID == "" {
		return nil, fmt.Errorf("group_id is required")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	rows, err := a.remoteDB.GetConn().Query(`
		SELECT id, group_id, slug, name, description, channel_type, created_by, created_at, updated_at
		FROM channel
		WHERE group_id = ?
		ORDER BY created_at ASC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query channels from Turso: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		channel := &models.Channel{}
		var description sql.NullString
		err := rows.Scan(&channel.ID, &channel.GroupID, &channel.Slug, &channel.Name, &description, &channel.ChannelType, &channel.CreatedBy, &channel.CreatedAt, &channel.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}

		// Handle NULL description
		if description.Valid {
			channel.Description = description.String
		} else {
			channel.Description = ""
		}

		channels = append(channels, channel)
	}

	return channels, rows.Err()
}

// ChannelExistsBySlug checks if a channel with the given slug exists in a group
func (a *App) ChannelExistsBySlug(groupID, slug string) (bool, error) {
	if groupID == "" || slug == "" {
		return false, fmt.Errorf("group_id and slug are required")
	}

	if a.remoteDB == nil {
		return false, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	var count int
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT COUNT(*)
		FROM channel
		WHERE group_id = ? AND slug = ?
	`, groupID, slug).Scan(&count)

	if err != nil {
		return false, fmt.Errorf("failed to check channel existence in Turso: %w", err)
	}

	return count > 0, nil
}

// GroupExistsBySlug checks if a group with the given slug exists
func (a *App) GroupExistsBySlug(slug string) (bool, error) {
	if slug == "" {
		return false, fmt.Errorf("slug is required")
	}

	if a.remoteDB == nil {
		return false, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly
	var count int
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT COUNT(*)
		FROM groups
		WHERE slug = ?
	`, slug).Scan(&count)

	if err != nil {
		return false, fmt.Errorf("failed to check group existence in Turso: %w", err)
	}

	return count > 0, nil
}

// SearchGroup searches for a group by ID, slug, or case-insensitive name
func (a *App) SearchGroup(queryString string) (*models.Group, error) {
	if queryString == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	if a.remoteDB == nil {
		return nil, fmt.Errorf("remote database not initialized")
	}

	// Query Turso directly - search by ID, slug, or name (case-insensitive)
	group := &models.Group{}
	var description sql.NullString
	err := a.remoteDB.GetConn().QueryRow(`
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE id = ? OR slug = ? OR LOWER(name) = LOWER(?)
		LIMIT 1
	`, queryString, queryString, queryString).Scan(&group.ID, &group.Slug, &group.Name, &description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to search group in Turso: %w", err)
	}

	// Handle NULL description
	if description.Valid {
		group.Description = description.String
	} else {
		group.Description = ""
	}

	return group, nil
}

// ========== Message Service Methods ==========

// SendMessage sends a message (encrypts and stores locally, queues if offline)
func (a *App) SendMessage(channelID, conversationID, authorID, content string, replyToMessageID string) (*models.Message, error) {
	// Validate input
	if content == "" {
		return nil, fmt.Errorf("message content cannot be empty")
	}
	if authorID == "" {
		return nil, fmt.Errorf("author_id is required")
	}
	if channelID == "" && conversationID == "" {
		return nil, fmt.Errorf("either channel_id or conversation_id must be provided")
	}
	if channelID != "" && conversationID != "" {
		return nil, fmt.Errorf("cannot specify both channel_id and conversation_id")
	}

	var ciphertext []byte
	var nonce []byte

	if channelID != "" {
		// Group message: use sender key
		channel, err := a.GetChannel(channelID)
		if err != nil {
			return nil, fmt.Errorf("failed to get channel: %w", err)
		}
		senderKey, err := a.signalService.GetOrCreateSenderKey(channel.GroupID, channelID)
		if err != nil {
			return nil, fmt.Errorf("failed to get sender key: %w", err)
		}
		ct, n, err := signal.EncryptWithSenderKey(senderKey, []byte(content))
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt group message: %w", err)
		}
		ciphertext = ct
		nonce = n
	} else if conversationID != "" {
		// DM: use double ratchet
		conv, err := a.dmService.GetConversationByID(conversationID)
		if err != nil {
			return nil, fmt.Errorf("failed to get conversation: %w", err)
		}
		// Session must already be established via pre-key exchange
		session, err := a.signalSessionService.GetSession(authorID, conv.User2Identifier)
		if err != nil || session == nil {
			return nil, fmt.Errorf("no established session for DM; complete pre-key exchange first")
		}
		// For DM, EncryptMessage returns nonce || ciphertext combined
		encryptedContent, err := a.signalService.EncryptMessage(session, []byte(content))
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt message: %w", err)
		}
		// Split nonce and ciphertext (assuming 24-byte nonce for NaCl)
		if len(encryptedContent) < 24 {
			return nil, fmt.Errorf("encrypted content too short")
		}
		nonce = encryptedContent[:24]
		ciphertext = encryptedContent[24:]
	}

	// Create message (using new schema field names)
	message := &models.Message{
		ChannelID:        channelID,
		ConversationID:   conversationID,
		SenderID:         authorID,
		Ciphertext:       ciphertext,
		Nonce:            nonce,
		ReplyToMessageID: replyToMessageID,
	}

	if err := a.messageService.CreateMessage(message); err != nil {
		return nil, fmt.Errorf("failed to create message: %w", err)
	}

	// Update conversation timestamp if DM
	if conversationID != "" {
		if err := a.dmService.UpdateConversationTimestamp(conversationID); err != nil {
			// Log but don't fail
			fmt.Printf("Warning: failed to update conversation timestamp: %v\n", err)
		}
	}

	// Always add to queue (will be processed when online)
	if err := a.queueService.AddToQueue(message.ID); err != nil {
		return nil, fmt.Errorf("failed to queue message: %w", err)
	}

	// Process queue if online and queue processor is available
	if a.networkService.IsOnline() && a.queueProcessor != nil {
		go func() {
			if err := a.queueProcessor.TriggerProcessing(); err != nil {
				fmt.Printf("Warning: failed to process queue: %v\n", err)
			}
		}()
	}

	// Set the decrypted content for immediate display (we have the plaintext)
	message.Content = content

	// Publish to Ably if service is available (async, don't block)
	if a.ablyRealtimeService != nil {
		go func() {
			// Determine which channel/conversation to publish to
			targetID := channelID
			if targetID == "" {
				targetID = conversationID
			}

			messageData := map[string]interface{}{
				"message_id":      message.ID,
				"channel_id":      message.ChannelID,
				"conversation_id": message.ConversationID,
				"sender_id":       message.SenderID,
				"created_at":      message.CreatedAt,
			}

			err := a.ablyRealtimeService.PublishMessage(targetID, messageData)
			if err != nil {
				// Log but don't fail - message is already stored locally
				fmt.Printf("Warning: failed to publish message to Ably: %v\n", err)
			}
		}()
	}

	return message, nil
}

// GetMessages gets messages for a channel or conversation
func (a *App) GetMessages(channelID, conversationID string, limit, offset int) ([]*models.Message, error) {
	// Validate input
	if channelID == "" && conversationID == "" {
		return nil, fmt.Errorf("either channel_id or conversation_id must be provided")
	}
	if channelID != "" && conversationID != "" {
		return nil, fmt.Errorf("cannot specify both channel_id and conversation_id")
	}
	if limit <= 0 {
		limit = 50 // Default limit
	}
	if limit > 1000 {
		limit = 1000 // Max limit
	}
	if offset < 0 {
		offset = 0
	}

	var messages []*models.Message
	var err error

	if channelID != "" {
		messages, err = a.messageService.ListMessagesByChannel(channelID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("failed to get channel messages: %w", err)
		}
		// Decrypt messages for channel using sender key
		channel, err := a.GetChannel(channelID)
		if err != nil {
			return nil, fmt.Errorf("failed to get channel: %w", err)
		}
		senderKey, err := a.signalService.GetOrCreateSenderKey(channel.GroupID, channelID)
		if err != nil {
			return nil, fmt.Errorf("failed to get sender key: %w", err)
		}
		for _, msg := range messages {
			// Nonce and ciphertext are stored separately in DB
			if len(msg.Nonce) == 0 || len(msg.Ciphertext) == 0 {
				msg.Content = "[decrypt error: missing nonce or ciphertext]"
				continue
			}
			pt, err := signal.DecryptWithSenderKey(senderKey, msg.Ciphertext, msg.Nonce)
			if err != nil {
				msg.Content = fmt.Sprintf("[decrypt error: %v]", err)
				continue
			}
			msg.Content = string(pt)
		}
	} else if conversationID != "" {
		messages, err = a.messageService.ListMessagesByConversation(conversationID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("failed to get conversation messages: %w", err)
		}
		// Decrypt messages for DM
		conv, err := a.dmService.GetConversationByID(conversationID)
		if err != nil {
			return nil, fmt.Errorf("failed to get conversation: %w", err)
		}

		currentUser, err := a.GetCurrentUser()
		if err != nil {
			return nil, fmt.Errorf("failed to get current user: %w", err)
		}

		var remoteIdentifier string
		if currentUser.ID == conv.User1ID {
			remoteIdentifier = conv.User2Identifier
		} else {
			remoteIdentifier = conv.User1ID
		}

		for _, msg := range messages {
			session, err := a.signalSessionService.GetSession(currentUser.ID, remoteIdentifier)
			if err != nil || session == nil {
				msg.Content = "[Unable to decrypt - no session]"
				continue
			}
			// DecryptMessage expects nonce || ciphertext combined (same format as EncryptMessage output)
			if len(msg.Nonce) == 0 || len(msg.Ciphertext) == 0 {
				msg.Content = "[decrypt error: missing nonce or ciphertext]"
				continue
			}
			combined := append(msg.Nonce, msg.Ciphertext...)
			decrypted, err := a.signalService.DecryptMessage(session, combined)
			if err != nil {
				msg.Content = fmt.Sprintf("[Decryption error: %v]", err)
				continue
			}
			msg.Content = string(decrypted)
		}
	}

	return messages, nil
}

// PinMessage pins a message
func (a *App) PinMessage(messageID, pinnedBy string) error {
	return a.messageService.PinMessage(messageID, pinnedBy)
}

// UnpinMessage unpins a message
func (a *App) UnpinMessage(messageID string) error {
	return a.messageService.UnpinMessage(messageID)
}

// GetPinnedMessages gets pinned messages for a channel or conversation
func (a *App) GetPinnedMessages(channelID, conversationID string) ([]*models.Message, error) {
	return a.messageService.GetPinnedMessages(channelID, conversationID)
}

// ========== DM Service Methods ==========

// CreateOrGetDMConversation creates or gets a DM conversation
func (a *App) CreateOrGetDMConversation(user1ID, user2Identifier string) (*models.DMConversation, error) {
	if user1ID == "" {
		return nil, fmt.Errorf("user1_id is required")
	}
	if user2Identifier == "" {
		return nil, fmt.Errorf("user2_identifier is required")
	}
	conv, err := a.dmService.CreateOrGetConversation(user1ID, user2Identifier)
	if err != nil {
		return nil, fmt.Errorf("failed to create or get conversation: %w", err)
	}
	return conv, nil
}

// ListDMConversations lists all DM conversations for a user
func (a *App) ListDMConversations(userID string) ([]*models.DMConversation, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}
	conversations, err := a.dmService.ListUserConversations(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list conversations: %w", err)
	}
	return conversations, nil
}

// ========== Queue Service Methods ==========

// GetPendingMessages gets pending messages from the queue
func (a *App) GetPendingMessages() ([]*models.MessageQueue, error) {
	return a.queueService.GetPendingMessages()
}

// CancelQueuedMessage cancels a queued message
func (a *App) CancelQueuedMessage(messageID string) error {
	return a.queueService.CancelMessage(messageID)
}

// ProcessQueue manually triggers queue processing
func (a *App) ProcessQueue() error {
	if a.queueProcessor == nil {
		return fmt.Errorf("queue processor not initialized - call SetServiceURL first")
	}
	if !a.networkService.IsOnline() {
		return fmt.Errorf("network is not available")
	}
	return a.queueProcessor.TriggerProcessing()
}

// ========== Authentication & Session Management Methods ==========

// GetStoredSession retrieves the stored session from keychain
// Returns a map with userID and clerkToken for Wails binding
func (a *App) GetStoredSession() (map[string]string, error) {
	if a.keychainService == nil {
		return nil, fmt.Errorf("keychain service not initialized")
	}
	userID, clerkToken, err := a.keychainService.GetStoredSession()
	if err != nil {
		return nil, err
	}
	if userID == "" || clerkToken == "" {
		return nil, nil
	}
	return map[string]string{
		"userID":     userID,
		"clerkToken": clerkToken,
	}, nil
}

// StoreSession stores the session (userID and clerkToken) in keychain
func (a *App) StoreSession(clerkToken string, userID string) error {
	if a.keychainService == nil {
		return fmt.Errorf("keychain service not initialized")
	}
	return a.keychainService.StoreSession(userID, clerkToken)
}

// ClearSession removes the stored session from keychain
func (a *App) ClearSession() error {
	if a.keychainService == nil {
		return fmt.Errorf("keychain service not initialized")
	}
	return a.keychainService.ClearSession()
}

// AuthenticateAndLoadUser authenticates with Clerk and loads/creates the user
// This replaces CreateProfileWithClerk with a simplified flow
func (a *App) AuthenticateAndLoadUser(clerkToken string) (*models.User, error) {
	if a.clerkService == nil {
		return nil, fmt.Errorf("Clerk service not initialized")
	}

	// Verify the token (handles both JWTs and session tokens)
	clerkUser, err := a.clerkService.VerifySessionToken(a.ctx, clerkToken)

	if err != nil {
		return nil, fmt.Errorf("failed to verify Clerk token: %w", err)
	}

	var userID string
	var user *models.User

	// First, check LOCAL database for existing user by clerk_id
	// This prevents creating duplicate users when re-authenticating
	if a.userService != nil {
		localUser, err := a.userService.GetUserByClerkID(clerkUser.ID)
		if err == nil && localUser != nil {
			// User exists locally, use existing User ID
			userID = localUser.ID
			user = localUser
			fmt.Printf("Found existing user in local DB: %s (clerk_id: %s)\n", userID, clerkUser.ID)
		}
	}

	// If not found locally, query Turso for existing User by clerk_id
	if userID == "" && a.remoteDB != nil {
		var remoteUserID string
		err := a.remoteDB.GetConn().QueryRow("SELECT id FROM users WHERE clerk_id = ?", clerkUser.ID).Scan(&remoteUserID)
		if err == nil && remoteUserID != "" {
			// User exists in Turso, use existing User ID
			userID = remoteUserID
			fmt.Printf("Found existing user in Turso: %s (clerk_id: %s)\n", userID, clerkUser.ID)
		}
	}

	// If User doesn't exist anywhere, create new User
	if userID == "" {
		// Generate ULID for new User
		userID = utils.NewULID()
		fmt.Printf("Creating new user: %s (clerk_id: %s)\n", userID, clerkUser.ID)
	}

	// Check if UserSnapshot exists locally
	userSnapshotExists := a.profileService.UserSnapshotExists(userID)

	// Generate encryption key if UserSnapshot doesn't exist
	var encryptionKey []byte
	if !userSnapshotExists {
		encryptionKey = make([]byte, 32)
		if _, err := rand.Read(encryptionKey); err != nil {
			return nil, fmt.Errorf("failed to generate encryption key: %w", err)
		}
		// Store encryption key in keychain
		if err := a.keychainService.StoreEncryptionKey(userID, encryptionKey); err != nil {
			return nil, fmt.Errorf("failed to store encryption key: %w", err)
		}
	} else {
		// Get existing encryption key
		var err error
		encryptionKey, err = a.keychainService.GetEncryptionKey(userID)
		if err != nil {
			// Encryption key not found - this can happen after migrating to file backend
			// Generate a new encryption key (user will need to re-sync messages)
			fmt.Printf("Encryption key not found, generating new key for existing user\n")
			encryptionKey = make([]byte, 32)
			if _, err := rand.Read(encryptionKey); err != nil {
				return nil, fmt.Errorf("failed to generate encryption key: %w", err)
			}
			// Store new encryption key in keychain
			if err := a.keychainService.StoreEncryptionKey(userID, encryptionKey); err != nil {
				return nil, fmt.Errorf("failed to store encryption key: %w", err)
			}
		}
	}

	// Load UserSnapshot
	if err := a.loadUserSnapshot(userID); err != nil {
		return nil, fmt.Errorf("failed to load UserSnapshot: %w", err)
	}

	// Now that UserSnapshot is loaded, check if User exists in local database
	// (userService is now initialized from loadUserSnapshot)
	if user == nil && a.userService != nil {
		localUser, err := a.userService.GetUserByClerkID(clerkUser.ID)
		if err == nil && localUser != nil {
			user = localUser
			fmt.Printf("Found existing user in local DB (after snapshot load): %s (clerk_id: %s)\n", user.ID, clerkUser.ID)
		}
	}

	// Create User in local database if it doesn't exist
	if user == nil {
		// Per AUTH_AND_DB_MIGRATION.md: Identity keys now stored separately via IdentityKeyService
		// Generate identity keys for the user
		publicKey, privateKey, err := a.signalService.GenerateIdentityKeyPair()
		if err != nil {
			return nil, fmt.Errorf("failed to generate identity keys: %w", err)
		}

		// Create minimal user record (no identity keys)
		user = &models.User{
			ID:      userID,
			ClerkID: clerkUser.ID,
		}

		if err := a.userService.CreateUser(user); err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
		fmt.Printf("Created new user in local DB: %s (clerk_id: %s)\n", user.ID, user.ClerkID)

		// Store identity keys via IdentityKeyService
		if a.identityKeyService != nil {
			_, err := a.identityKeyService.CreateIdentityKey(publicKey, privateKey)
			if err != nil {
				return nil, fmt.Errorf("failed to store identity keys: %w", err)
			}
			fmt.Printf("Stored identity keys for user: %s\n", user.ID)
		}

		// Register User in Turso
		if a.remoteDB == nil {
			fmt.Printf("WARNING: Turso not initialized! User NOT registered in Turso DB.\n")
		} else {
			// Extract primary email and phone from Clerk user
			var email, phone, username, avatarURL sql.NullString

			// Get primary email
			if clerkUser.PrimaryEmailAddressID != nil && len(clerkUser.EmailAddresses) > 0 {
				for _, emailAddr := range clerkUser.EmailAddresses {
					if emailAddr.ID == *clerkUser.PrimaryEmailAddressID {
						email = sql.NullString{String: emailAddr.EmailAddress, Valid: true}
						break
					}
				}
			}

			// Get primary phone
			if clerkUser.PrimaryPhoneNumberID != nil && len(clerkUser.PhoneNumbers) > 0 {
				for _, phoneNum := range clerkUser.PhoneNumbers {
					if phoneNum.ID == *clerkUser.PrimaryPhoneNumberID {
						phone = sql.NullString{String: phoneNum.PhoneNumber, Valid: true}
						break
					}
				}
			}

			// Get username
			if clerkUser.Username != nil && *clerkUser.Username != "" {
				username = sql.NullString{String: *clerkUser.Username, Valid: true}
			}

			// Get avatar URL
			if clerkUser.ImageURL != nil && *clerkUser.ImageURL != "" {
				avatarURL = sql.NullString{String: *clerkUser.ImageURL, Valid: true}
			}

			now := time.Now().Unix()
			_, err := a.remoteDB.GetConn().Exec(`
				INSERT INTO users (id, clerk_id, username, email, phone, avatar_url, created_at, disabled)
				VALUES (?, ?, ?, ?, ?, ?, ?, 0)
			`, user.ID, clerkUser.ID, username, email, phone, avatarURL, now)
			if err != nil {
				// Log error but don't fail - user is already created locally
				fmt.Printf("WARNING: Failed to register user in Turso: %v\n", err)
			} else {
				fmt.Printf("✓ User registered in Turso: %s (clerk_id: %s)\n", user.ID, clerkUser.ID)
			}
		}
	} else {
		fmt.Printf("Found existing user in local DB: %s (clerk_id: %s)\n", user.ID, user.ClerkID)
	}

	// Store session
	if err := a.keychainService.StoreSession(user.ID, clerkToken); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return user, nil
}

// AuthenticateWithClerk implements browser-based OAuth for desktop apps
//
// Flow:
// 1. Desktop app starts local server on :44665 with two endpoints:
//   - /clerk-redirect: HTML page that loads Clerk SDK to extract JWT token
//   - /callback: Receives the JWT token and completes authentication
//
// 2. Opens browser to Clerk's hosted sign-in page
// 3. After sign-in, Clerk redirects to /clerk-redirect (still in browser)
// 4. The clerk-redirect page uses Clerk SDK to get JWT token from session
// 5. Redirects to /callback with the token
// 6. Desktop app receives token and authenticates user
//
// Note: The intermediate /clerk-redirect page is necessary because Clerk stores
// sessions in browser cookies. We need JavaScript in the browser context to
// extract the JWT token using Clerk's SDK. Production Clerk instances return
// proper JWTs that work with desktop apps.
//
// Environment Variables:
// - VITE_CLERK_PUBLISHABLE_KEY: Required. Clerk publishable key
// - CLERK_ACCOUNT_PORTAL_URL: Optional. Override the sign-in URL (e.g., "https://accounts.clerk.com/sign-in/your-instance")
func (a *App) AuthenticateWithClerk() (string, error) {
	pubKey := os.Getenv("VITE_CLERK_PUBLISHABLE_KEY")
	if pubKey == "" {
		return "", fmt.Errorf("VITE_CLERK_PUBLISHABLE_KEY not set in environment")
	}

	// Generate random state for CSRF protection
	state := randomState()
	result := make(chan string, 1)
	a.authCancel = make(chan struct{})

	// Extract Clerk frontend API domain from publishable key
	frontendAPIDomain, err := extractClerkDomain(pubKey)
	if err != nil {
		return "", fmt.Errorf("failed to extract Clerk domain: %w", err)
	}

	// For sign-in, we need the Account Portal domain, not the Frontend API domain
	// By convention: clerk.pollis.com → accounts.pollis.com
	accountPortalDomain := strings.Replace(frontendAPIDomain, "clerk.", "accounts.", 1)

	// Allow override via environment variable for custom Account Portal URLs
	if overrideDomain := os.Getenv("CLERK_SIGN_IN_URL"); overrideDomain != "" {
		fmt.Printf("[Auth] Using override sign-in URL from CLERK_SIGN_IN_URL: %s\n", overrideDomain)
		accountPortalDomain = overrideDomain
	} else {
		fmt.Printf("[Auth] Using Account Portal domain: %s (derived from Frontend API: %s)\n", accountPortalDomain, frontendAPIDomain)
	}

	// Setup local HTTP server for OAuth callback
	mux := http.NewServeMux()
	a.authServer = &http.Server{
		Addr:    "127.0.0.1:44665",
		Handler: mux,
	}

	// Clerk redirect endpoint - serves HTML that uses Clerk SDK to get JWT token
	mux.HandleFunc("/clerk-redirect", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[Auth] Serving Clerk redirect page...\n")

		// Parse template
		tmpl, err := template.New("clerk-redirect").Parse(clerkRedirectTemplate)
		if err != nil {
			http.Error(w, "template error", http.StatusInternalServerError)
			return
		}

		// Build callback URL
		callbackURL := fmt.Sprintf("http://127.0.0.1:44665/callback?state=%s", url.QueryEscape(state))

		// Render template
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		tmpl.Execute(w, map[string]string{
			"PublishableKey": pubKey,
			"CallbackURL":    callbackURL,
		})
	})

	// Callback endpoint - receives JWT token and completes authentication
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		// Verify state for CSRF protection
		receivedState := r.URL.Query().Get("state")
		if receivedState != state {
			fmt.Printf("[Auth] Invalid state parameter\n")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`<!DOCTYPE html>
<html>
<head><title>Authentication Error</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #111; color: #ef4444;">
	<h1>Authentication Error</h1>
	<p>Invalid state parameter. Please try again.</p>
</body>
</html>`))
			return
		}

		// Get JWT token from query parameter
		token := r.URL.Query().Get("token")
		if token == "" {
			fmt.Printf("[Auth] No token received\n")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`<!DOCTYPE html>
<html>
<head><title>Authentication Error</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #111; color: #ef4444;">
	<h1>Authentication Error</h1>
	<p>No token received. Please try again.</p>
</body>
</html>`))
			return
		}

		fmt.Printf("[Auth] JWT token received successfully (length: %d)\n", len(token))

		// Success - show user they can close the browser
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(`<!DOCTYPE html>
<html>
<head><title>Authentication Successful</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #111; color: #fbbf24;">
	<h1>✓ Authentication Successful</h1>
	<p>You can close this window and return to the app.</p>
	<script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`))

		result <- token
		go a.authServer.Shutdown(context.Background())
	})

	// For production: Use web-hosted callback page that redirects to localhost
	// For development: Can use localhost directly
	clerkRedirectURL := os.Getenv("CLERK_REDIRECT_URL")
	if clerkRedirectURL == "" {
		// Default to production callback page
		clerkRedirectURL = "https://pollis.com/auth-callback"
	}

	// Build the authentication URL with state parameter
	// The state is appended to the redirect URL so the web callback can pass it through
	clerkRedirectURLWithState := fmt.Sprintf("%s?state=%s", clerkRedirectURL, url.QueryEscape(state))

	var authURL string
	if strings.HasPrefix(accountPortalDomain, "http://") || strings.HasPrefix(accountPortalDomain, "https://") {
		// Full URL provided (from CLERK_SIGN_IN_URL override)
		authURL = fmt.Sprintf("%s?redirect_url=%s", accountPortalDomain, url.QueryEscape(clerkRedirectURLWithState))
	} else {
		// Domain only - construct full URL
		authURL = fmt.Sprintf("https://%s/sign-in?redirect_url=%s",
			accountPortalDomain,
			url.QueryEscape(clerkRedirectURLWithState),
		)
	}

	// Start server
	go a.authServer.ListenAndServe()

	// Open browser
	fmt.Printf("[Auth] Opening browser to: %s\n", authURL)
	if err := browser.OpenURL(authURL); err != nil {
		a.authServer.Shutdown(context.Background())
		a.authServer = nil
		a.authCancel = nil
		return "", fmt.Errorf("failed to open browser: %w", err)
	}

	// Wait for callback, cancel, or timeout
	select {
	case token := <-result:
		a.authServer = nil
		a.authCancel = nil
		fmt.Printf("[Auth] Authentication completed successfully\n")
		return token, nil
	case <-a.authCancel:
		a.authServer.Shutdown(context.Background())
		a.authServer = nil
		a.authCancel = nil
		return "", fmt.Errorf("authentication cancelled")
	case <-time.After(5 * time.Minute):
		a.authServer.Shutdown(context.Background())
		a.authServer = nil
		a.authCancel = nil
		return "", fmt.Errorf("authentication timeout")
	}
}

// CancelAuth cancels an in-progress authentication flow
func (a *App) CancelAuth() error {
	if a.authCancel != nil {
		close(a.authCancel)
	}
	return nil
}

// randomState generates a random state string for CSRF protection
func randomState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// extractClerkDomain extracts the Clerk frontend API domain from the publishable key
// For development instances: pk_test_... → instance.clerk.accounts.dev
// For production instances: pk_live_... → custom domain or instance.clerk.accounts.com
func extractClerkDomain(pubKey string) (string, error) {
	// Remove "pk_test_" or "pk_live_" prefix
	var encodedDomain string
	if len(pubKey) > 8 && pubKey[:8] == "pk_test_" {
		encodedDomain = pubKey[8:]
	} else if len(pubKey) > 8 && pubKey[:8] == "pk_live_" {
		encodedDomain = pubKey[8:]
	} else {
		return "", fmt.Errorf("invalid publishable key format")
	}

	// Decode base64
	decoded, err := base64.StdEncoding.DecodeString(encodedDomain)
	if err != nil {
		// Try RawStdEncoding if regular fails
		decoded, err = base64.RawStdEncoding.DecodeString(encodedDomain)
		if err != nil {
			return "", fmt.Errorf("failed to decode domain: %w", err)
		}
	}

	// Remove any trailing $ or other special characters
	domain := string(decoded)
	if len(domain) > 0 && domain[len(domain)-1] == '$' {
		domain = domain[:len(domain)-1]
	}

	fmt.Printf("[Auth] Extracted Clerk domain: %s\n", domain)

	return domain, nil
}

// Logout clears the session and optionally deletes the UserSnapshot
func (a *App) Logout(deleteSnapshot bool) error {
	// Get current user ID from session before clearing
	var userID string
	if a.db != nil && a.userService != nil {
		users, err := a.userService.ListUsers()
		if err == nil && len(users) > 0 {
			userID = users[0].ID
		}
	}

	// Close database
	if a.db != nil {
		a.db.Close()
		a.db = nil
	}

	// Stop queue processor
	if a.queueProcessor != nil {
		a.queueProcessor.Stop()
		a.queueProcessor = nil
	}

	// Close service client
	if a.serviceClient != nil {
		a.serviceClient.Close()
		a.serviceClient = nil
	}

	// Close Ably service
	if a.ablyRealtimeService != nil {
		a.ablyRealtimeService.Close()
		a.ablyRealtimeService = nil
	}

	// Clear services
	a.userService = nil
	a.groupService = nil
	a.channelService = nil
	a.messageService = nil
	a.dmService = nil
	a.queueService = nil
	a.signalService = nil
	a.signalSessionService = nil
	a.groupKeyService = nil

	// Clear session
	if err := a.keychainService.ClearSession(); err != nil {
		fmt.Printf("Warning: failed to clear session: %v\n", err)
	}

	// Optionally delete UserSnapshot
	if deleteSnapshot && userID != "" {
		// Delete encryption key
		if err := a.keychainService.DeleteEncryptionKey(userID); err != nil {
			fmt.Printf("Warning: failed to delete encryption key: %v\n", err)
		}
		// Delete UserSnapshot directory
		if err := a.profileService.DeleteUserSnapshot(userID); err != nil {
			fmt.Printf("Warning: failed to delete UserSnapshot: %v\n", err)
		}
	}

	return nil
}

// ========== Ably Realtime Methods ==========

// SubscribeToChannel subscribes to Ably channel and emits events to frontend
func (a *App) SubscribeToChannel(channelID string) error {
	if a.ablyRealtimeService == nil {
		return fmt.Errorf("Ably service not initialized")
	}

	return a.ablyRealtimeService.SubscribeToChannel(channelID, func(messageData map[string]interface{}) {
		// Emit event to frontend via Wails
		runtime.EventsEmit(a.ctx, "ably:message", messageData)
	})
}

// UnsubscribeFromChannel unsubscribes from Ably channel
func (a *App) UnsubscribeFromChannel(channelID string) error {
	if a.ablyRealtimeService == nil {
		return fmt.Errorf("Ably service not initialized")
	}

	return a.ablyRealtimeService.UnsubscribeFromChannel(channelID)
}

// IsAblyReady returns whether the Ably service is initialized and ready
func (a *App) IsAblyReady() bool {
	return a.ablyRealtimeService != nil
}

// ========== R2 Object Storage Methods ==========

// PresignedUploadResponse contains the presigned URL and object key for an upload
type PresignedUploadResponse struct {
	UploadURL string `json:"upload_url"` // Presigned PUT URL
	ObjectKey string `json:"object_key"` // Object key to use for the upload
	PublicURL string `json:"public_url"` // Public URL (if bucket is public, otherwise use presigned GET)
}

// GetPresignedAvatarUploadURL generates a presigned PUT URL for uploading a user avatar
// userID: The user's ID
// aliasID: Optional alias ID (e.g., for different avatars per group/context). Use empty string for default.
// filename: Original filename (used to determine extension)
// contentType: MIME type of the file (e.g., "image/png", "image/jpeg")
// Returns the presigned URL, object key, and public URL
func (a *App) GetPresignedAvatarUploadURL(userID, aliasID, filename, contentType string) (*PresignedUploadResponse, error) {
	if a.r2Service == nil {
		return nil, fmt.Errorf("R2 service not initialized")
	}

	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}

	if filename == "" {
		return nil, fmt.Errorf("filename is required")
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Generate object key
	objectKey := a.r2Service.GenerateAvatarKey(userID, aliasID, filename)

	// Generate presigned URL (valid for 1 hour)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	uploadURL, err := a.r2Service.PresignedUploadURL(ctx, objectKey, contentType, 1*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	fmt.Printf("[R2] Generated presigned URL for avatar: %s (object key: %s, content-type: %s)\n",
		uploadURL[:min(100, len(uploadURL))], objectKey, contentType)

	return &PresignedUploadResponse{
		UploadURL: uploadURL,
		ObjectKey: objectKey,
		PublicURL: a.r2Service.GetPublicURL(objectKey),
	}, nil
}

// min returns the minimum of two integers (helper for string truncation)
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetPresignedFileUploadURL generates a presigned PUT URL for uploading a file attachment
// channelID: Channel ID (if channel message) - can be empty
// conversationID: Conversation ID (if DM) - can be empty
// messageID: Message ID (if already created) - can be empty for new messages
// filename: Original filename
// contentType: MIME type of the file
// Returns the presigned URL, object key, and public URL
func (a *App) GetPresignedFileUploadURL(channelID, conversationID, messageID, filename, contentType string) (*PresignedUploadResponse, error) {
	if a.r2Service == nil {
		return nil, fmt.Errorf("R2 service not initialized")
	}

	if channelID == "" && conversationID == "" {
		return nil, fmt.Errorf("either channel_id or conversation_id is required")
	}

	if filename == "" {
		return nil, fmt.Errorf("filename is required")
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Generate object key
	objectKey := a.r2Service.GenerateFileKey(channelID, conversationID, messageID, filename)

	// Generate presigned URL (valid for 1 hour)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	uploadURL, err := a.r2Service.PresignedUploadURL(ctx, objectKey, contentType, 1*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return &PresignedUploadResponse{
		UploadURL: uploadURL,
		ObjectKey: objectKey,
		PublicURL: a.r2Service.GetPublicURL(objectKey),
	}, nil
}

// GetPresignedFileDownloadURL generates a presigned GET URL for downloading a file
// objectKey: The object key in R2
// Returns the presigned URL (valid for 1 hour)
func (a *App) GetPresignedFileDownloadURL(objectKey string) (string, error) {
	if a.r2Service == nil {
		return "", fmt.Errorf("R2 service not initialized")
	}

	if objectKey == "" {
		return "", fmt.Errorf("object_key is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	downloadURL, err := a.r2Service.PresignedGetURL(ctx, objectKey, 1*time.Hour)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned download URL: %w", err)
	}

	return downloadURL, nil
}

// DeleteFile deletes a file from R2 storage
func (a *App) DeleteFile(objectKey string) error {
	if a.r2Service == nil {
		return fmt.Errorf("R2 service not initialized")
	}

	if objectKey == "" {
		return fmt.Errorf("object_key is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := a.r2Service.DeleteObject(ctx, objectKey)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
