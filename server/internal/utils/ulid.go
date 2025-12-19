package utils

import (
	"time"

	"github.com/oklog/ulid/v2"
)

// NewULID generates a new ULID
func NewULID() string {
	entropy := ulid.DefaultEntropy()
	return ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()
}

// ParseULID parses a ULID string
func ParseULID(s string) (ulid.ULID, error) {
	return ulid.Parse(s)
}

