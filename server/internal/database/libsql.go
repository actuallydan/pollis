package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// DB wraps the database connection
type DB struct {
	conn *sql.DB
}

// NewDB creates a new database connection
// dbURL can be a local file path (./path.db or file:./path.db) or Turso URL (libsql://host:port?authToken=...)
func NewDB(dbURL string) (*DB, error) {
	var conn *sql.DB
	var err error

	// Only support Turso remote databases
	if !strings.HasPrefix(dbURL, "libsql://") {
		return nil, fmt.Errorf("invalid database URL: must start with libsql:// (Turso URL)")
	}

	// Remote libSQL/Turso connection
	conn, err = sql.Open("libsql", dbURL)
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

		// Execute migration - split into individual statements
		statements := splitSQLStatements(string(content))
		for i, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" || strings.HasPrefix(stmt, "--") {
				continue // Skip empty statements and comments
			}
			_, err = db.conn.Exec(stmt)
			if err != nil {
				return fmt.Errorf("failed to execute migration %s (statement %d): %w\nStatement: %s", file, i+1, err, stmt[:min(len(stmt), 200)])
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

// splitSQLStatements splits a SQL file into individual statements
func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	inQuote := false
	quoteChar := rune(0)

	lines := strings.Split(sql, "\n")
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Skip comment-only lines
		if strings.HasPrefix(trimmedLine, "--") {
			continue
		}

		// Process the line character by character to handle quotes properly
		for i, ch := range line {
			if !inQuote {
				if ch == '\'' || ch == '"' {
					inQuote = true
					quoteChar = ch
				} else if ch == ';' {
					// End of statement
					stmt := strings.TrimSpace(current.String())
					if stmt != "" {
						statements = append(statements, stmt)
					}
					current.Reset()
					continue
				}
			} else if ch == quoteChar {
				// Check if it's an escaped quote
				if i+1 < len(line) && rune(line[i+1]) == quoteChar {
					current.WriteRune(ch)
					continue
				}
				inQuote = false
			}
			current.WriteRune(ch)
		}
		current.WriteRune('\n')
	}

	// Add any remaining statement
	stmt := strings.TrimSpace(current.String())
	if stmt != "" && stmt != ";" {
		statements = append(statements, stmt)
	}

	return statements
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
