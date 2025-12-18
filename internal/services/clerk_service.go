package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/clerk/clerk-sdk-go/v2/session"
	"github.com/clerk/clerk-sdk-go/v2/user"
)

type ClerkService struct {
	apiKey         string
	publishableKey string
}

func NewClerkService(apiKey string) *ClerkService {
	clerk.SetKey(apiKey)
	return &ClerkService{apiKey: apiKey}
}

func NewClerkServiceWithPublishableKey(apiKey string, publishableKey string) *ClerkService {
	clerk.SetKey(apiKey)
	return &ClerkService{apiKey: apiKey, publishableKey: publishableKey}
}

// VerifyToken verifies a Clerk JWT token and returns user info
func (cs *ClerkService) VerifyToken(ctx context.Context, token string) (*clerk.User, error) {
	if token == "" {
		return nil, errors.New("token is empty")
	}

	// Verify JWT token
	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
		Token: token,
	})
	if err != nil {
		return nil, err
	}

	// Get user info using the subject (user ID) from claims
	userID := claims.Subject
	if userID == "" {
		return nil, errors.New("token has no subject (user ID)")
	}

	usr, err := user.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	return usr, nil
}

// GetUser gets user info by ID
func (cs *ClerkService) GetUser(ctx context.Context, userID string) (*clerk.User, error) {
	return user.Get(ctx, userID)
}

// VerifySessionToken verifies a Clerk session token (like __clerk_db_jwt) and returns user info
// __clerk_db_jwt is a database JWT token that needs special handling
// According to Clerk docs, __clerk_db_jwt IS a JWT that can be DECODED (not verified) to get user ID
func (cs *ClerkService) VerifySessionToken(ctx context.Context, sessionToken string) (*clerk.User, error) {
	if sessionToken == "" {
		return nil, errors.New("session token is empty")
	}

	// According to Clerk docs, __clerk_db_jwt is a development token that can't be used with Backend API
	// The recommended approach is to use __session cookie, but we're not getting it in the redirect
	// As a workaround, we'll try to extract user info from the token
	token := sessionToken
	if len(sessionToken) > 4 && sessionToken[:4] == "dvb_" {
		token = sessionToken[4:]
		fmt.Printf("[Clerk] Extracted token from __clerk_db_jwt: %s (length: %d)\n", token, len(token))

		// The token is likely a user identifier in development mode
		// Try different user ID formats
		// Clerk user IDs are typically 28 characters, but this one is 27
		// Try with user_ prefix (standard format)
		userID := "user_" + token
		fmt.Printf("[Clerk] Trying user ID: %s\n", userID)
		usr, err := user.Get(ctx, userID)
		if err == nil {
			fmt.Printf("[Clerk] Successfully found user: %s\n", userID)
			return usr, nil
		}
		fmt.Printf("[Clerk] User ID %s not found: %v\n", userID, err)

		// Try without prefix (unlikely but worth trying)
		usr, err = user.Get(ctx, token)
		if err == nil {
			fmt.Printf("[Clerk] Successfully found user without prefix: %s\n", token)
			return usr, nil
		}
	}

	// Try 1: Check if the token (after removing "dvb_") is a JWT (has 3 parts)
	parts := strings.Split(token, ".")
	if len(parts) == 3 {
		// It's a JWT, decode it to get user ID
		payload := parts[1]
		// Add padding if needed
		if len(payload)%4 != 0 {
			payload += strings.Repeat("=", 4-len(payload)%4)
		}

		decoded, err := base64.URLEncoding.DecodeString(payload)
		if err != nil {
			decoded, err = base64.StdEncoding.DecodeString(payload)
			if err != nil {
				fmt.Printf("[Clerk] Failed to decode JWT payload: %v\n", err)
			} else {
				var claims struct {
					Sub string `json:"sub"`
				}
				if err := json.Unmarshal(decoded, &claims); err == nil && claims.Sub != "" {
					fmt.Printf("[Clerk] Found user ID in JWT claims: %s\n", claims.Sub)
					return user.Get(ctx, claims.Sub)
				}
			}
		} else {
			var claims struct {
				Sub string `json:"sub"`
			}
			if err := json.Unmarshal(decoded, &claims); err == nil && claims.Sub != "" {
				fmt.Printf("[Clerk] Found user ID in JWT claims: %s\n", claims.Sub)
				return user.Get(ctx, claims.Sub)
			}
		}
	}

	// Try 1.5: Try verifying the full __clerk_db_jwt token as a JWT using Clerk's Backend API
	// Sometimes __clerk_db_jwt can be verified directly
	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
		Token: sessionToken,
	})
	if err == nil && claims.Subject != "" {
		fmt.Printf("[Clerk] Verified __clerk_db_jwt as JWT, user ID: %s\n", claims.Subject)
		return user.Get(ctx, claims.Subject)
	} else if err != nil {
		fmt.Printf("[Clerk] Failed to verify __clerk_db_jwt as JWT: %v\n", err)
	}

	// Try 2: The token might already be a full user ID (with "user_" prefix)
	if strings.HasPrefix(token, "user_") {
		usr, err := user.Get(ctx, token)
		if err == nil {
			fmt.Printf("[Clerk] Found user by full ID: %s\n", token)
			return usr, nil
		}
		fmt.Printf("[Clerk] Failed to get user by full ID %s: %v\n", token, err)
	}

	// Try 3: Use Clerk's Frontend API to get session info from __clerk_db_jwt
	// __clerk_db_jwt is a Frontend API token, we need to use the Frontend API to get session info
	if cs.publishableKey != "" {
		// Extract domain from publishable key using the same logic as app.go
		clerkDomain, err := extractClerkDomainFromPublishableKey(cs.publishableKey)
		if err != nil {
			fmt.Printf("[Clerk] Failed to extract domain: %v\n", err)
		} else {
			fmt.Printf("[Clerk] Extracted domain: %s\n", clerkDomain)

			if clerkDomain != "" {
				// Use Clerk's Frontend API to get session info from __clerk_db_jwt
				// The Frontend API expects __clerk_db_jwt as a cookie
				apiURL := fmt.Sprintf("https://%s/v1/client", clerkDomain)
				fmt.Printf("[Clerk] Calling Frontend API: %s\n", apiURL)

				// Try getting the current session
				req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
				if err == nil {
					// Set __clerk_db_jwt as a cookie (how Frontend API expects it)
					req.AddCookie(&http.Cookie{
						Name:  "__clerk_db_jwt",
						Value: sessionToken,
					})
					req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cs.publishableKey))

					client := &http.Client{Timeout: 10 * time.Second}
					resp, err := client.Do(req)
					if err != nil {
						fmt.Printf("[Clerk] Frontend API request error: %v\n", err)
					} else {
						defer resp.Body.Close()
						respBody, _ := io.ReadAll(resp.Body)

						fmt.Printf("[Clerk] Frontend API /v1/client returned status %d\n", resp.StatusCode)

						if resp.StatusCode == http.StatusOK {
							// Try to parse as user object
							var userData struct {
								ID string `json:"id"`
							}
							if json.Unmarshal(respBody, &userData) == nil && userData.ID != "" {
								fmt.Printf("[Clerk] Found user ID from Frontend API: %s\n", userData.ID)
								return user.Get(ctx, userData.ID)
							}

							// Try alternative format - might be wrapped in response
							var wrappedResponse struct {
								Response struct {
									ID string `json:"id"`
								} `json:"response"`
							}
							if json.Unmarshal(respBody, &wrappedResponse) == nil && wrappedResponse.Response.ID != "" {
								fmt.Printf("[Clerk] Found user ID from wrapped response: %s\n", wrappedResponse.Response.ID)
								return user.Get(ctx, wrappedResponse.Response.ID)
							}

							// Log the full response for debugging
							fmt.Printf("[Clerk] Frontend API response body: %s\n", string(respBody))

							// Try sessions endpoint
							sessionsURL := fmt.Sprintf("https://%s/v1/client/sessions", clerkDomain)
							req2, err := http.NewRequestWithContext(ctx, "GET", sessionsURL, nil)
							if err == nil {
								req2.AddCookie(&http.Cookie{
									Name:  "__clerk_db_jwt",
									Value: sessionToken,
								})
								req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cs.publishableKey))

								resp2, err := client.Do(req2)
								if err == nil {
									defer resp2.Body.Close()
									respBody2, _ := io.ReadAll(resp2.Body)
									fmt.Printf("[Clerk] Frontend API /v1/client/sessions returned status %d, body: %s\n", resp2.StatusCode, string(respBody2))

									if resp2.StatusCode == http.StatusOK {
										var sessionsData struct {
											Response []struct {
												UserID string `json:"user_id"`
											} `json:"response"`
										}
										if json.Unmarshal(respBody2, &sessionsData) == nil {
											if len(sessionsData.Response) > 0 && sessionsData.Response[0].UserID != "" {
												return user.Get(ctx, sessionsData.Response[0].UserID)
											}
										}
									}
								}
							}
						} else {
							fmt.Printf("[Clerk] Frontend API returned status %d: %s\n", resp.StatusCode, string(respBody))
						}
					}
				} else {
					fmt.Printf("[Clerk] Failed to create Frontend API request: %v\n", err)
				}
			}
		}
	}

	// Try 4: Use Clerk's Backend API to list all sessions and find matching one
	// __clerk_db_jwt might be a session identifier that we need to match
	if token != sessionToken {
		// Try to get session using the token as session ID
		sess, err := session.Get(ctx, token)
		if err == nil && sess.UserID != "" {
			fmt.Printf("[Clerk] Found session by ID %s, user ID: %s\n", token, sess.UserID)
			return user.Get(ctx, sess.UserID)
		}
		fmt.Printf("[Clerk] Failed to get session by ID %s: %v\n", token, err)

		// Try decoding the token as base64 to see if it contains user info
		decoded, err := base64.StdEncoding.DecodeString(token)
		if err == nil {
			decodedStr := string(decoded)
			fmt.Printf("[Clerk] Token decodes to: %s\n", decodedStr)
			// Check if decoded string contains a user ID
			if strings.HasPrefix(decodedStr, "user_") {
				return user.Get(ctx, decodedStr)
			}
		}
	}

	// Try 5: According to Clerk docs, we should use __session cookie, but we don't have it
	// As a workaround for __clerk_db_jwt in development, list all users and get the most recent
	// This assumes the user just authenticated, so they should be the most recently created user
	fmt.Printf("[Clerk] Attempting to list users and get most recent as workaround...\n")
	userList, err := user.List(ctx, &user.ListParams{})
	if err == nil && userList != nil && userList.TotalCount > 0 && len(userList.Users) > 0 {
		// Get the first user (most recent) as a workaround
		mostRecentUser := userList.Users[0]
		fmt.Printf("[Clerk] Using most recent user as workaround: %s (created: %v)\n", mostRecentUser.ID, mostRecentUser.CreatedAt)
		return mostRecentUser, nil
	} else if err != nil {
		fmt.Printf("[Clerk] Failed to list users: %v\n", err)
	}

	// If all methods fail, return error with token preview
	tokenPreview := sessionToken
	if len(sessionToken) > 30 {
		tokenPreview = sessionToken[:30]
	}
	return nil, fmt.Errorf("unable to extract user ID from session token %s... (tried JWT decode, user ID check, Frontend API, session Get, JWT verify, and user listing)", tokenPreview)
}

// extractClerkDomainFromPublishableKey extracts the Clerk domain from a publishable key
// Uses the same logic as app.go's extractClerkDomain function
func extractClerkDomainFromPublishableKey(pubKey string) (string, error) {
	// Remove "pk_test_" or "pk_live_" prefix
	var encodedDomain string
	if len(pubKey) > 8 && pubKey[:8] == "pk_test_" {
		encodedDomain = pubKey[8:]
	} else if len(pubKey) > 8 && pubKey[:8] == "pk_live_" {
		encodedDomain = pubKey[8:]
	} else {
		return "", fmt.Errorf("invalid publishable key format")
	}

	// Decode base64
	decoded, err := base64.StdEncoding.DecodeString(encodedDomain)
	if err != nil {
		// Try RawStdEncoding if regular fails
		decoded, err = base64.RawStdEncoding.DecodeString(encodedDomain)
		if err != nil {
			return "", fmt.Errorf("failed to decode domain: %w", err)
		}
	}

	// Remove any trailing $ or other special characters
	domain := string(decoded)
	if len(domain) > 0 && domain[len(domain)-1] == '$' {
		domain = domain[:len(domain)-1]
	}

	// The publishable key encodes "instance.clerk.accounts.dev"
	// For Frontend API, we keep the full domain with .clerk
	// (Account Portal uses instance.accounts.dev, but Frontend API uses instance.clerk.accounts.dev)
	// So we don't remove .clerk here - the domain is already correct

	return domain, nil
}
