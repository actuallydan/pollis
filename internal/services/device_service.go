package services

import (
	"database/sql"
	"fmt"
	"time"

	"pollis/internal/models"
	"github.com/oklog/ulid/v2"
)

// DeviceService manages device registration and tracking
type DeviceService struct {
	db *sql.DB
}

// NewDeviceService creates a new DeviceService
func NewDeviceService(db *sql.DB) *DeviceService {
	return &DeviceService{db: db}
}

// RegisterDevice registers a new device for a user
func (s *DeviceService) RegisterDevice(clerkUserID, deviceName string, devicePublicKey []byte) (*models.Device, error) {
	device := &models.Device{
		ID:              ulid.Make().String(),
		ClerkUserID:     clerkUserID,
		DeviceName:      deviceName,
		DevicePublicKey: devicePublicKey,
		CreatedAt:       time.Now().Unix(),
	}

	query := `
		INSERT INTO device (id, clerk_user_id, device_name, device_public_key, created_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		device.ID,
		device.ClerkUserID,
		device.DeviceName,
		device.DevicePublicKey,
		device.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to register device: %w", err)
	}

	return device, nil
}

// GetDeviceByID retrieves a device by its ID
func (s *DeviceService) GetDeviceByID(id string) (*models.Device, error) {
	query := `
		SELECT id, clerk_user_id, device_name, device_public_key, created_at
		FROM device
		WHERE id = ?
	`

	device := &models.Device{}
	err := s.db.QueryRow(query, id).Scan(
		&device.ID,
		&device.ClerkUserID,
		&device.DeviceName,
		&device.DevicePublicKey,
		&device.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get device: %w", err)
	}

	return device, nil
}

// GetDevicesByClerkUserID retrieves all devices for a user
func (s *DeviceService) GetDevicesByClerkUserID(clerkUserID string) ([]*models.Device, error) {
	query := `
		SELECT id, clerk_user_id, device_name, device_public_key, created_at
		FROM device
		WHERE clerk_user_id = ?
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, clerkUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get devices: %w", err)
	}
	defer rows.Close()

	var devices []*models.Device
	for rows.Next() {
		device := &models.Device{}
		err := rows.Scan(
			&device.ID,
			&device.ClerkUserID,
			&device.DeviceName,
			&device.DevicePublicKey,
			&device.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan device: %w", err)
		}
		devices = append(devices, device)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating devices: %w", err)
	}

	return devices, nil
}

// GetCurrentDevice retrieves the most recently registered device for a user
// This is typically the device the user is currently using
func (s *DeviceService) GetCurrentDevice(clerkUserID string) (*models.Device, error) {
	query := `
		SELECT id, clerk_user_id, device_name, device_public_key, created_at
		FROM device
		WHERE clerk_user_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`

	device := &models.Device{}
	err := s.db.QueryRow(query, clerkUserID).Scan(
		&device.ID,
		&device.ClerkUserID,
		&device.DeviceName,
		&device.DevicePublicKey,
		&device.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get current device: %w", err)
	}

	return device, nil
}

// UpdateDeviceName updates the name of a device
func (s *DeviceService) UpdateDeviceName(id, deviceName string) error {
	query := `UPDATE device SET device_name = ? WHERE id = ?`
	_, err := s.db.Exec(query, deviceName, id)
	if err != nil {
		return fmt.Errorf("failed to update device name: %w", err)
	}
	return nil
}

// DeleteDevice removes a device
func (s *DeviceService) DeleteDevice(id string) error {
	query := `DELETE FROM device WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete device: %w", err)
	}
	return nil
}

// DeleteDevicesByClerkUserID removes all devices for a user
func (s *DeviceService) DeleteDevicesByClerkUserID(clerkUserID string) error {
	query := `DELETE FROM device WHERE clerk_user_id = ?`
	_, err := s.db.Exec(query, clerkUserID)
	if err != nil {
		return fmt.Errorf("failed to delete devices: %w", err)
	}
	return nil
}
