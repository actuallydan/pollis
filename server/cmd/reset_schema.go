package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/joho/godotenv/autoload"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
	// Get DB URL from environment
	dbURL := os.Getenv("TURSO_URL")
	authToken := os.Getenv("TURSO_TOKEN")

	if dbURL == "" {
		dbURL = os.Getenv("DB_URL")
	}

	if dbURL == "" {
		log.Fatal("TURSO_URL or DB_URL not set")
	}

	if authToken != "" && !strings.Contains(dbURL, "authToken=") {
		sep := "?"
		if strings.Contains(dbURL, "?") {
			sep = "&"
		}
		dbURL = fmt.Sprintf("%s%sauthToken=%s", dbURL, sep, authToken)
	}

	fmt.Printf("Connecting to database...\n")

	// Connect to database
	conn, err := sql.Open("libsql", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	if err := conn.Ping(); err != nil {
		log.Fatalf("Failed to ping: %v", err)
	}

	fmt.Println("✓ Connected")

	// List of tables to drop (in order to handle foreign key constraints)
	tablesToDrop := []string{
		"sender_key_recipients",
		"sender_keys",
		"webrtc_signaling",
		"key_exchange_messages",
		"rtc_participant",
		"rtc_room",
		"message_envelope",
		"channel",
		"alias",
		"group_member",
		"group_table", // Old name
		"groups",      // New name (in case it exists)
		"one_time_prekey",
		"signed_prekey",
		"identity_key",
		"device",
		"user",  // Old name
		"users", // New name (in case it exists)
	}

	fmt.Println("\nDropping existing tables...")
	for _, table := range tablesToDrop {
		_, err := conn.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
		if err != nil {
			fmt.Printf("Warning: failed to drop table %s: %v\n", table, err)
		} else {
			fmt.Printf("✓ Dropped table: %s\n", table)
		}
	}

	// Reset migration status
	fmt.Println("\nResetting migration status...")
	_, err = conn.Exec("DELETE FROM schema_migrations WHERE version = 1")
	if err != nil {
		// It's OK if this fails (table might not exist yet)
		fmt.Printf("Note: Could not delete migration record (this is OK if first run): %v\n", err)
	} else {
		fmt.Println("✓ Migration status reset")
	}

	fmt.Println("\n✓ Schema reset complete!")
	fmt.Println("\nNow restart the server to apply migrations with correct table names")
}
