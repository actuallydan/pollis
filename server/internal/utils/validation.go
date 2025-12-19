package utils

import (
	"fmt"
	"strings"
)

// ValidateUserID validates a user ID (ULID format)
func ValidateUserID(userID string) error {
	if userID == "" {
		return fmt.Errorf("user ID cannot be empty")
	}
	if len(userID) != 26 {
		return fmt.Errorf("user ID must be a valid ULID (26 characters)")
	}
	return nil
}

// ValidateUsername validates a username
func ValidateUsername(username string) error {
	if username == "" {
		return fmt.Errorf("username cannot be empty")
	}
	if len(username) < 3 {
		return fmt.Errorf("username must be at least 3 characters")
	}
	if len(username) > 50 {
		return fmt.Errorf("username must be less than 50 characters")
	}
	// Allow alphanumeric, underscore, hyphen
	for _, r := range username {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
			return fmt.Errorf("username can only contain letters, numbers, underscores, and hyphens")
		}
	}
	return nil
}

// ValidateGroupSlug validates a group slug
func ValidateGroupSlug(slug string) error {
	if slug == "" {
		return fmt.Errorf("group slug cannot be empty")
	}
	if len(slug) < 3 {
		return fmt.Errorf("group slug must be at least 3 characters")
	}
	if len(slug) > 50 {
		return fmt.Errorf("group slug must be less than 50 characters")
	}
	// Allow lowercase alphanumeric and hyphens
	slug = strings.ToLower(slug)
	for _, r := range slug {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
			return fmt.Errorf("group slug can only contain lowercase letters, numbers, and hyphens")
		}
	}
	return nil
}

// ValidateChannelName validates a channel name
func ValidateChannelName(name string) error {
	if name == "" {
		return fmt.Errorf("channel name cannot be empty")
	}
	if len(name) < 1 {
		return fmt.Errorf("channel name must be at least 1 character")
	}
	if len(name) > 100 {
		return fmt.Errorf("channel name must be less than 100 characters")
	}
	return nil
}

// ValidateUserIdentifier validates a user identifier (username, email, or phone)
func ValidateUserIdentifier(identifier string) error {
	if identifier == "" {
		return fmt.Errorf("user identifier cannot be empty")
	}
	return nil
}

// ValidateEmail validates an email address (basic check)
func ValidateEmail(email string) error {
	if email == "" {
		return nil // Email is optional
	}
	if !strings.Contains(email, "@") {
		return fmt.Errorf("invalid email format")
	}
	if len(email) > 255 {
		return fmt.Errorf("email must be less than 255 characters")
	}
	return nil
}

// ValidatePhone validates a phone number (basic check)
func ValidatePhone(phone string) error {
	if phone == "" {
		return nil // Phone is optional
	}
	// Remove common phone number characters
	cleaned := strings.ReplaceAll(phone, "-", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	cleaned = strings.ReplaceAll(cleaned, "(", "")
	cleaned = strings.ReplaceAll(cleaned, ")", "")
	cleaned = strings.ReplaceAll(cleaned, "+", "")
	
	if len(cleaned) < 10 {
		return fmt.Errorf("phone number must be at least 10 digits")
	}
	if len(cleaned) > 15 {
		return fmt.Errorf("phone number must be less than 15 digits")
	}
	// Check if all remaining characters are digits
	for _, r := range cleaned {
		if r < '0' || r > '9' {
			return fmt.Errorf("phone number can only contain digits and common formatting characters")
		}
	}
	return nil
}

