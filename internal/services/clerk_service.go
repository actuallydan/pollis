package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/clerk/clerk-sdk-go/v2/session"
	"github.com/clerk/clerk-sdk-go/v2/user"
)

// ClerkService handles Clerk authentication verification
// Simplified version - only supports proper JWT verification (no fallback logic)
type ClerkService struct {
	apiKey string
}

// NewClerkService creates a new ClerkService
func NewClerkService(apiKey string) *ClerkService {
	clerk.SetKey(apiKey)
	return &ClerkService{apiKey: apiKey}
}

// VerifySessionToken verifies a Clerk session token or JWT and returns user info
// This is the primary method for verifying tokens from the OAuth callback
// It handles both JWT tokens (with 3 parts) and session tokens (session IDs)
func (cs *ClerkService) VerifySessionToken(ctx context.Context, sessionToken string) (*clerk.User, error) {
	if sessionToken == "" {
		return nil, errors.New("session token is empty")
	}

	// Check if token is a JWT (has 3 parts separated by dots)
	// JWTs have format: header.payload.signature
	dotCount := 0
	for _, c := range sessionToken {
		if c == '.' {
			dotCount++
		}
	}

	if dotCount == 2 {
		// It's a JWT token, verify using JWT verification
		claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
			Token: sessionToken,
		})
		if err != nil {
			return nil, err
		}

		// Extract user ID from claims
		userID := claims.Subject
		if userID == "" {
			return nil, errors.New("token has no subject (user ID)")
		}

		// Fetch user details
		usr, err := user.Get(ctx, userID)
		if err != nil {
			return nil, err
		}

		return usr, nil
	} else {
		// It's a session ID (not a JWT), get the session and extract user

		// Check if this is a dev browser token (starts with dvb_)
		if len(sessionToken) > 4 && sessionToken[:4] == "dvb_" {
			return nil, fmt.Errorf("authentication error: received Clerk development browser token (__clerk_db_jwt) which cannot be used with desktop apps.\n\nFor development:\n1. Your Clerk instance is in development mode and returns browser-only tokens\n2. These tokens only work in web browsers, not desktop apps\n\nTo fix this:\n• Option A: Use a Clerk production instance (recommended for desktop apps)\n• Option B: Configure your Clerk app for native/mobile flows in Dashboard → Settings → Authentication\n• Option C: Implement custom OAuth PKCE flow instead of using Clerk's hosted pages\n\nSee CLERK_SETUP.md for more details")
		}

		sess, err := session.Get(ctx, sessionToken)
		if err != nil {
			// If session.Get fails, return a helpful error message
			return nil, fmt.Errorf("failed to verify Clerk session token: %w", err)
		}

		// Get user ID from session
		userID := sess.UserID
		if userID == "" {
			return nil, errors.New("session has no user ID")
		}

		// Fetch user details
		usr, err := user.Get(ctx, userID)
		if err != nil {
			return nil, err
		}

		return usr, nil
	}
}

// VerifySession verifies a Clerk session ID and returns the session details
func (cs *ClerkService) VerifySession(ctx context.Context, sessionID string) (*clerk.Session, error) {
	if sessionID == "" {
		return nil, errors.New("session ID is empty")
	}

	sess, err := session.Get(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	return sess, nil
}

// GetUser gets user info by Clerk user ID
func (cs *ClerkService) GetUser(ctx context.Context, userID string) (*clerk.User, error) {
	if userID == "" {
		return nil, errors.New("user ID is empty")
	}

	return user.Get(ctx, userID)
}

// GetUserByEmail gets user info by email
func (cs *ClerkService) GetUserByEmail(ctx context.Context, email string) ([]*clerk.User, error) {
	if email == "" {
		return nil, errors.New("email is empty")
	}

	result, err := user.List(ctx, &user.ListParams{
		EmailAddresses: []string{email},
	})
	if err != nil {
		return nil, err
	}

	return result.Users, nil
}

// GetUserByPhoneNumber gets user info by phone number
func (cs *ClerkService) GetUserByPhoneNumber(ctx context.Context, phoneNumber string) ([]*clerk.User, error) {
	if phoneNumber == "" {
		return nil, errors.New("phone number is empty")
	}

	result, err := user.List(ctx, &user.ListParams{
		PhoneNumbers: []string{phoneNumber},
	})
	if err != nil {
		return nil, err
	}

	return result.Users, nil
}

// RevokeSession revokes a Clerk session
func (cs *ClerkService) RevokeSession(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return errors.New("session ID is empty")
	}

	_, err := session.Revoke(ctx, &session.RevokeParams{ID: sessionID})
	return err
}
