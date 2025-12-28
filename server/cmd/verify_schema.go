package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
	dbURL := os.Getenv("TURSO_URL")
	authToken := os.Getenv("TURSO_TOKEN")

	if dbURL == "" {
		log.Fatal("TURSO_URL not set")
	}

	if authToken != "" && !strings.Contains(dbURL, "authToken=") {
		sep := "?"
		if strings.Contains(dbURL, "?") {
			sep = "&"
		}
		dbURL = fmt.Sprintf("%s%sauthToken=%s", dbURL, sep, authToken)
	}

	conn, err := sql.Open("libsql", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// Verify tables exist
	tables := []string{
		"users", "groups", "group_member", "channel",
		"identity_key", "signed_prekey", "one_time_prekey",
		"prekey_bundles", "one_time_prekeys", "prekey_bundle_requests", "key_backups",
	}

	fmt.Println("========================================")
	fmt.Println("Verifying Turso Database Schema")
	fmt.Println("========================================\n")

	allGood := true
	for _, table := range tables {
		var count int
		err := conn.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			fmt.Printf("❌ Table %s: %v\n", table, err)
			allGood = false
		} else {
			fmt.Printf("✓ Table %s exists (%d rows)\n", table, count)
		}
	}

	// Verify users table columns
	rows, err := conn.Query("PRAGMA table_info(users)")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("\n========================================")
	fmt.Println("Users Table Columns:")
	fmt.Println("========================================")
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, dflt_value, pk interface{}
		rows.Scan(&cid, &name, &typ, &notnull, &dflt_value, &pk)
		fmt.Printf("  ✓ %s (%s)\n", name, typ)
	}

	// Verify group_member table columns
	rows2, err := conn.Query("PRAGMA table_info(group_member)")
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	fmt.Println("\n========================================")
	fmt.Println("Group_Member Table Columns:")
	fmt.Println("========================================")
	for rows2.Next() {
		var cid int
		var name, typ string
		var notnull, dflt_value, pk interface{}
		rows2.Scan(&cid, &name, &typ, &notnull, &dflt_value, &pk)
		fmt.Printf("  ✓ %s (%s)\n", name, typ)
	}

	if allGood {
		fmt.Println("\n========================================")
		fmt.Println("✅ ALL SCHEMA CHECKS PASSED!")
		fmt.Println("========================================")
	} else {
		fmt.Println("\n========================================")
		fmt.Println("❌ SOME SCHEMA CHECKS FAILED")
		fmt.Println("========================================")
	}
}
