package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/joho/godotenv/autoload"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
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
	conn, err := sql.Open("libsql", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	if err := conn.Ping(); err != nil {
		log.Fatalf("Failed to ping: %v", err)
	}

	fmt.Println("✓ Connected")

	// Reset migration status
	fmt.Println("\nResetting migration status...")
	_, err = conn.Exec("DELETE FROM schema_migrations WHERE version = 1")
	if err != nil {
		log.Fatalf("Failed to delete migration record: %v", err)
	}

	fmt.Println("✓ Migration status reset")
	fmt.Println("\nNow restart the server to re-apply migrations")
}
