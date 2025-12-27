package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"pollis-service/internal/database"
)

func main() {
	// Load .env.local from parent directory
	_ = godotenv.Load("../.env.local")

	// Get DB URL from environment
	dbURL := os.Getenv("TURSO_URL")
	authToken := os.Getenv("TURSO_TOKEN")

	if dbURL == "" {
		log.Fatal("TURSO_URL not set")
	}

	if authToken != "" {
		dbURL = fmt.Sprintf("%s?authToken=%s", dbURL, authToken)
	}

	fmt.Printf("Connecting to: %s\n", dbURL[:50]+"...")

	// Connect to database
	db, err := database.NewDB(dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	fmt.Println("✓ Connected successfully")

	// Check for schema_migrations table
	var count int
	err = db.GetConn().QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count)
	if err != nil {
		log.Fatalf("Failed to query schema_migrations: %v", err)
	}
	fmt.Printf("✓ Schema migrations applied: %d\n", count)

	// List all applied migrations
	rows, err := db.GetConn().Query("SELECT version, applied_at FROM schema_migrations ORDER BY version")
	if err != nil {
		log.Fatalf("Failed to query migrations: %v", err)
	}
	defer rows.Close()

	fmt.Println("\nApplied migrations:")
	for rows.Next() {
		var version int
		var appliedAt int64
		if err := rows.Scan(&version, &appliedAt); err != nil {
			log.Fatalf("Failed to scan row: %v", err)
		}
		fmt.Printf("  - Version %d (applied at: %d)\n", version, appliedAt)
	}

	// Check for key tables
	tables := []string{
		"user",
		"device",
		"identity_key",
		"signed_prekey",
		"one_time_prekey",
		"group_table",
		"group_member",
		"channel",
		"alias",
		"message_envelope",
	}

	fmt.Println("\nChecking for tables:")
	for _, table := range tables {
		var exists int
		query := fmt.Sprintf("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='%s'", table)
		err = db.GetConn().QueryRow(query).Scan(&exists)
		if err != nil {
			fmt.Printf("  ✗ %s - ERROR: %v\n", table, err)
		} else if exists == 1 {
			fmt.Printf("  ✓ %s\n", table)
		} else {
			fmt.Printf("  ✗ %s - NOT FOUND\n", table)
		}
	}

	// List ALL tables in the database
	fmt.Println("\nAll tables in database:")
	rows2, err := db.GetConn().Query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
	if err != nil {
		log.Fatalf("Failed to list tables: %v", err)
	}
	defer rows2.Close()

	tableCount := 0
	for rows2.Next() {
		var name string
		if err := rows2.Scan(&name); err != nil {
			log.Fatalf("Failed to scan table name: %v", err)
		}
		fmt.Printf("  - %s\n", name)
		tableCount++
	}

	if tableCount == 0 {
		fmt.Println("  (no tables found!)")
	}

	fmt.Println("\n✓ Schema verification complete")
}
