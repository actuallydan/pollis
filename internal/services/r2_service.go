package services

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/oklog/ulid/v2"
)

// R2Service handles Cloudflare R2 object storage operations
type R2Service struct {
	s3Client *s3.Client
	bucket   string
	endpoint string
}

// NewR2Service creates a new R2 service instance
func NewR2Service() (*R2Service, error) {
	// Get credentials from environment (loaded from .env.local in main.go)
	accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	secretKey := os.Getenv("R2_SECRET_KEY")
	endpoint := os.Getenv("R2_S3_ENDPOINT")

	if accessKeyID == "" || secretKey == "" || endpoint == "" {
		return nil, fmt.Errorf("R2 credentials not configured (R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_S3_ENDPOINT required). Check .env.local file")
	}

	fmt.Printf("[R2] Initializing R2 service with endpoint: %s\n", endpoint)
	fmt.Printf("[R2] Access Key ID: %s...\n", accessKeyID[:min(8, len(accessKeyID))])

	// Parse endpoint to extract bucket name
	// Format: https://account-id.r2.cloudflarestorage.com/bucket-name
	parsedURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("invalid R2_S3_ENDPOINT format: %w", err)
	}

	// Extract bucket from path (remove leading slash)
	bucket := strings.TrimPrefix(parsedURL.Path, "/")
	if bucket == "" {
		return nil, fmt.Errorf("bucket name not found in R2_S3_ENDPOINT path")
	}

	// Base endpoint without bucket path
	baseEndpoint := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)

	// Create AWS config with custom endpoint for R2
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, "")),
		awsconfig.WithRegion("auto"), // R2 doesn't use regions, but SDK requires it
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client with custom endpoint resolver for R2
	s3Client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(baseEndpoint)
		o.UsePathStyle = true // R2 requires path-style addressing
	})

	fmt.Printf("[R2] Bucket: %s, Base endpoint: %s\n", bucket, baseEndpoint)

	return &R2Service{
		s3Client: s3Client,
		bucket:   bucket,
		endpoint: baseEndpoint,
	}, nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// PresignedUploadURL generates a presigned PUT URL for uploading a file
// Returns the presigned URL and the object key that should be used
// For browser uploads, the Content-Type must match exactly what's sent in the request
func (r *R2Service) PresignedUploadURL(ctx context.Context, objectKey string, contentType string, expiresIn time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(r.s3Client)

	// Create PutObjectInput with ContentType included in signature
	putInput := &s3.PutObjectInput{
		Bucket:      aws.String(r.bucket),
		Key:         aws.String(objectKey),
		ContentType: aws.String(contentType),
	}

	request, err := presignClient.PresignPutObject(ctx, putInput, func(opts *s3.PresignOptions) {
		opts.Expires = expiresIn
	})

	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return request.URL, nil
}

// PresignedGetURL generates a presigned GET URL for downloading a file
func (r *R2Service) PresignedGetURL(ctx context.Context, objectKey string, expiresIn time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(r.s3Client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(objectKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expiresIn
	})

	if err != nil {
		return "", fmt.Errorf("failed to generate presigned GET URL: %w", err)
	}

	return request.URL, nil
}

// GenerateAvatarKey generates an object key for a user avatar
// Format: avatars/{userID}/{aliasID}/{filename}
// If aliasID is empty, uses "default"
func (r *R2Service) GenerateAvatarKey(userID, aliasID, filename string) string {
	if aliasID == "" {
		aliasID = "default"
	}

	// Extract extension from filename or default to .png
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".png"
	}

	// Generate unique filename with ULID to avoid collisions
	uniqueID := ulid.Make().String()
	baseName := strings.TrimSuffix(filepath.Base(filename), ext)
	uniqueFilename := fmt.Sprintf("%s_%s%s", baseName, uniqueID, ext)

	return fmt.Sprintf("avatars/%s/%s/%s", userID, aliasID, uniqueFilename)
}

// GenerateFileKey generates an object key for a chat file attachment
// Format: files/{channelID|conversationID}/{messageID}/{filename}
func (r *R2Service) GenerateFileKey(channelID, conversationID, messageID, filename string) string {
	var prefix string
	if channelID != "" {
		prefix = fmt.Sprintf("channels/%s", channelID)
	} else if conversationID != "" {
		prefix = fmt.Sprintf("conversations/%s", conversationID)
	} else {
		// Fallback for files not yet associated with a message
		prefix = "temp"
	}

	// Generate unique filename to avoid collisions
	ext := filepath.Ext(filename)
	baseName := strings.TrimSuffix(filepath.Base(filename), ext)
	uniqueID := ulid.Make().String()
	uniqueFilename := fmt.Sprintf("%s_%s%s", baseName, uniqueID, ext)

	if messageID != "" {
		return fmt.Sprintf("%s/%s/%s", prefix, messageID, uniqueFilename)
	}
	return fmt.Sprintf("%s/%s", prefix, uniqueFilename)
}

// GetPublicURL returns the public URL for an object (if bucket is public)
// For private buckets, use PresignedGetURL instead
func (r *R2Service) GetPublicURL(objectKey string) string {
	return fmt.Sprintf("%s/%s/%s", r.endpoint, r.bucket, objectKey)
}
