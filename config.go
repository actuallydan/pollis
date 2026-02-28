package main

import "os"

// Build-time configuration values injected via ldflags.
// Example: go build -ldflags "-X main.cfgServiceURL=https://api.pollis.com"
// At runtime, os.Getenv() takes precedence so dev can override via .env.local.
var (
	cfgServiceURL    string
	cfgClerkSecret   string
	cfgClerkPubKey   string
	cfgAblyKey       string
	cfgTursoURL      string
	cfgTursoToken    string
	cfgR2AccessKey   string
	cfgR2SecretKey   string
	cfgR2Endpoint    string
	cfgR2PublicURL   string
)

// getConfig returns the runtime env var if set, otherwise the build-time value.
func getConfig(envKey string) string {
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	return buildTimeConfigs[envKey]
}

// buildTimeConfigs maps env var names to their build-time values.
// Populated in init() from ldflags-injected variables.
var buildTimeConfigs map[string]string

func init() {
	buildTimeConfigs = map[string]string{
		"VITE_SERVICE_URL":           cfgServiceURL,
		"CLERK_SECRET_KEY":           cfgClerkSecret,
		"VITE_CLERK_PUBLISHABLE_KEY": cfgClerkPubKey,
		"ABLY_API_KEY":               cfgAblyKey,
		"TURSO_URL":                  cfgTursoURL,
		"TURSO_TOKEN":                cfgTursoToken,
		"R2_ACCESS_KEY_ID":           cfgR2AccessKey,
		"R2_SECRET_KEY":              cfgR2SecretKey,
		"R2_S3_ENDPOINT":             cfgR2Endpoint,
		"R2_PUBLIC_URL":              cfgR2PublicURL,
	}
}
