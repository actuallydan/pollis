package services

import (
	"database/sql"
	"fmt"
	"pollis/internal/models"
	"pollis/internal/utils"
)

// GroupService handles group-related operations
type GroupService struct {
	db *sql.DB
}

// NewGroupService creates a new group service
func NewGroupService(db *sql.DB) *GroupService {
	return &GroupService{db: db}
}

// CreateGroup creates a new group
func (s *GroupService) CreateGroup(group *models.Group) error {
	if group.ID == "" {
		group.ID = utils.NewULID()
	}

	query := `
		INSERT INTO groups (id, slug, name, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	now := utils.GetCurrentTimestamp()
	group.CreatedAt = now
	group.UpdatedAt = now

	_, err := s.db.Exec(query, group.ID, group.Slug, group.Name, group.Description,
		group.CreatedBy, group.CreatedAt, group.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create group: %w", err)
	}

	return nil
}

// GetGroupByID retrieves a group by ID
func (s *GroupService) GetGroupByID(id string) (*models.Group, error) {
	group := &models.Group{}
	query := `
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE id = ?
	`

	err := s.db.QueryRow(query, id).Scan(
		&group.ID, &group.Slug, &group.Name, &group.Description,
		&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	return group, nil
}

// GetGroupBySlug retrieves a group by slug
func (s *GroupService) GetGroupBySlug(slug string) (*models.Group, error) {
	group := &models.Group{}
	query := `
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE slug = ?
	`

	err := s.db.QueryRow(query, slug).Scan(
		&group.ID, &group.Slug, &group.Name, &group.Description,
		&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	return group, nil
}

// AddGroupMember adds a member to a group
func (s *GroupService) AddGroupMember(groupID, userIdentifier string) error {
	member := &models.GroupMember{
		ID:             utils.NewULID(),
		GroupID:        groupID,
		UserIdentifier: userIdentifier,
		JoinedAt:       utils.GetCurrentTimestamp(),
	}

	query := `
		INSERT INTO group_membership (id, group_id, user_id, joined_at)
		VALUES (?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, member.ID, member.GroupID, member.UserIdentifier, member.JoinedAt)
	if err != nil {
		return fmt.Errorf("failed to add group member: %w", err)
	}

	return nil
}

// IsGroupMember checks if a user is a member of a group
func (s *GroupService) IsGroupMember(groupID, userIdentifier string) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM group_membership
		WHERE group_id = ? AND user_id = ?
	`

	err := s.db.QueryRow(query, groupID, userIdentifier).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check group membership: %w", err)
	}

	return count > 0, nil
}

// ListUserGroups lists all groups a user is a member of
func (s *GroupService) ListUserGroups(userIdentifier string) ([]*models.Group, error) {
	query := `
		SELECT g.id, g.slug, g.name, g.description, g.created_by, g.created_at, g.updated_at
		FROM groups g
		INNER JOIN group_membership gm ON g.id = gm.group_id
		WHERE gm.user_id = ?
		ORDER BY g.created_at DESC
	`

	rows, err := s.db.Query(query, userIdentifier)
	if err != nil {
		return nil, fmt.Errorf("failed to list user groups: %w", err)
	}
	defer rows.Close()

	var groups []*models.Group
	for rows.Next() {
		group := &models.Group{}
		err := rows.Scan(
			&group.ID, &group.Slug, &group.Name, &group.Description,
			&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group: %w", err)
		}
		groups = append(groups, group)
	}

	return groups, rows.Err()
}

// ListGroupMembers lists all members of a group
func (s *GroupService) ListGroupMembers(groupID string) ([]*models.GroupMember, error) {
	query := `
		SELECT id, group_id, user_id, joined_at
		FROM group_membership
		WHERE group_id = ?
		ORDER BY joined_at ASC
	`

	rows, err := s.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list group members: %w", err)
	}
	defer rows.Close()

	var members []*models.GroupMember
	for rows.Next() {
		member := &models.GroupMember{}
		err := rows.Scan(
			&member.ID, &member.GroupID, &member.UserIdentifier, &member.JoinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		members = append(members, member)
	}

	return members, rows.Err()
}

// RemoveGroupMember removes a member from a group
func (s *GroupService) RemoveGroupMember(groupID, userIdentifier string) error {
	query := `
		DELETE FROM group_membership
		WHERE group_id = ? AND user_id = ?
	`

	_, err := s.db.Exec(query, groupID, userIdentifier)
	if err != nil {
		return fmt.Errorf("failed to remove group member: %w", err)
	}

	return nil
}

// UpdateGroup updates group information
func (s *GroupService) UpdateGroup(group *models.Group) error {
	group.UpdatedAt = utils.GetCurrentTimestamp()

	query := `
		UPDATE groups
		SET slug = ?, name = ?, description = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, group.Slug, group.Name, group.Description, group.UpdatedAt, group.ID)
	if err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}

	return nil
}

// GroupExistsBySlug checks if a group with the given slug exists
// This is an efficient query using the indexed slug column
func (s *GroupService) GroupExistsBySlug(slug string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM groups WHERE slug = ?)`
	
	err := s.db.QueryRow(query, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check group existence: %w", err)
	}
	
	return exists, nil
}

// SearchGroup searches for a group by ID, slug, or case-insensitive name
// The query is optimized to use indexes and return quickly with minimal reads
// queryString can be an ID, slug, or name (case-insensitive)
func (s *GroupService) SearchGroup(queryString string) (*models.Group, error) {
	if queryString == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	// First try exact slug match (fastest - uses unique index)
	group, err := s.GetGroupBySlug(queryString)
	if err == nil {
		return group, nil
	}

	// Try exact ID match (uses primary key index)
	group, err = s.GetGroupByID(queryString)
	if err == nil {
		return group, nil
	}

	// Finally, try case-insensitive name search
	query := `
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE name = ? COLLATE NOCASE
		LIMIT 1
	`

	group = &models.Group{}
	err = s.db.QueryRow(query, queryString).Scan(
		&group.ID, &group.Slug, &group.Name, &group.Description,
		&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to search group: %w", err)
	}

	return group, nil
}
