package services

import (
	"context"
	"errors"

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

// VerifySessionToken verifies a Clerk session token (JWT) and returns user info
// This is the primary method for verifying tokens from the OAuth callback
func (cs *ClerkService) VerifySessionToken(ctx context.Context, sessionToken string) (*clerk.User, error) {
	if sessionToken == "" {
		return nil, errors.New("session token is empty")
	}

	// Verify the JWT token using Clerk's SDK
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
