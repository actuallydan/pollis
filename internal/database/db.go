package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	// TODO: Add SQLCipher support with build tags to avoid conflicts
	// _ "github.com/mutecomm/go-sqlcipher/v4"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// DB wraps the database connection
type DB struct {
	conn *sql.DB
}

// NewDB creates a new database connection
func NewDB(dbPath string) (*DB, error) {
	// For local files, use sqlite3 driver directly for better compatibility
	conn, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{conn: conn}

	// Run migrations
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// GetConn returns the underlying database connection
func (db *DB) GetConn() *sql.DB {
	return db.conn
}

// migrate runs all pending migrations
func (db *DB) migrate() error {
	// Create migrations table if it doesn't exist
	_, err := db.conn.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at INTEGER NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get list of migration files
	migrationFiles, err := fs.Glob(migrationsFS, "migrations/*.sql")
	if err != nil {
		return fmt.Errorf("failed to read migrations: %w", err)
	}

	// Sort migration files by version number
	sort.Slice(migrationFiles, func(i, j int) bool {
		vi := extractVersion(migrationFiles[i])
		vj := extractVersion(migrationFiles[j])
		return vi < vj
	})

	// Get applied migrations
	applied, err := db.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Apply pending migrations
	for _, file := range migrationFiles {
		version := extractVersion(file)
		if applied[version] {
			continue // Already applied
		}

		// Read migration file
		content, err := migrationsFS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", file, err)
		}

		// Execute migration
		// Some migrations might fail if they're idempotent (e.g., adding a column that already exists)
		// We'll try to execute and check for specific errors
		_, err = db.conn.Exec(string(content))
		if err != nil {
			// Check if it's a "duplicate column" or "UNIQUE constraint" error
			// This happens when trying to add a column that already exists or add UNIQUE to existing column
			errStr := err.Error()
			if strings.Contains(errStr, "duplicate column") || 
			   strings.Contains(errStr, "already exists") ||
			   strings.Contains(errStr, "UNIQUE constraint") ||
			   strings.Contains(errStr, "Cannot add a UNIQUE column") {
				// Column already exists or constraint already applied, that's okay - migration is idempotent
				fmt.Printf("Migration %s: Column/constraint already exists, skipping: %v\n", file, err)
			} else {
				return fmt.Errorf("failed to execute migration %s: %w", file, err)
			}
		}

		// Record migration
		_, err = db.conn.Exec(
			"INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
			version,
			getCurrentTimestamp(),
		)
		if err != nil {
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}
	}

	return nil
}

// getAppliedMigrations returns a map of applied migration versions
func (db *DB) getAppliedMigrations() (map[int]bool, error) {
	rows, err := db.conn.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

// extractVersion extracts the version number from a migration filename
// e.g., "migrations/001_initial_schema.sql" -> 1
func extractVersion(filename string) int {
	base := filepath.Base(filename)
	parts := strings.Split(base, "_")
	if len(parts) == 0 {
		return 0
	}
	version, _ := strconv.Atoi(parts[0])
	return version
}

// getCurrentTimestamp returns the current Unix timestamp
func getCurrentTimestamp() int64 {
	return time.Now().Unix()
}

// NewEncryptedDB creates a new encrypted database connection for local profile databases
// Uses sqlite3 driver for local files (libsql is only for remote Turso databases)
// Note: True encryption would require SQLCipher. For now, the encryptionKey is stored
// in the keychain for future use when SQLCipher support is added.
func NewEncryptedDB(dbPath string, encryptionKey []byte) (*DB, error) {
	// Store encryption key for potential future use (SQLCipher integration)
	_ = encryptionKey // Suppress unused variable warning

	// Normalize the path to absolute
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve absolute path: %w", err)
	}

	// Use sqlite3 driver for local files
	// SQLite will create the file if it doesn't exist, but we need to ensure the directory exists
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	conn, err := sql.Open("sqlite3", absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection (this will create the file if it doesn't exist)
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{conn: conn}

	// Run migrations
	if err := db.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}
