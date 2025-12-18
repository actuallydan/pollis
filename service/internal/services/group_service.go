package services

import (
	"database/sql"
	"errors"
	"fmt"

	"pollis-service/internal/database"
	"pollis-service/internal/models"
	"pollis-service/internal/utils"
)

type GroupService struct {
	db          *database.DB
	authService *AuthService
}

func NewGroupService(db *database.DB) *GroupService {
	return &GroupService{
		db:          db,
		authService: NewAuthService(db),
	}
}

// CreateGroup creates a new group
func (s *GroupService) CreateGroup(groupID, slug, name string, description *string, createdBy string) error {
	// Validate inputs
	if err := utils.ValidateUserID(groupID); err != nil {
		return err
	}
	if err := utils.ValidateGroupSlug(slug); err != nil {
		return err
	}
	if name == "" {
		return fmt.Errorf("group name cannot be empty")
	}
	if len(name) > 100 {
		return fmt.Errorf("group name must be less than 100 characters")
	}
	if err := utils.ValidateUserIdentifier(createdBy); err != nil {
		return err
	}

	// Verify creator exists
	exists, err := s.authService.UserExistsByIdentifier(createdBy)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("creator user does not exist")
	}

	now := utils.GetCurrentTimestamp()

	_, err = s.db.GetConn().Exec(`
		INSERT INTO groups (id, slug, name, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, groupID, slug, name, description, createdBy, now, now)
	if err != nil {
		return fmt.Errorf("failed to create group: %w", err)
	}

	// Add creator as a member
	memberID := utils.NewULID()
	_, err = s.db.GetConn().Exec(`
		INSERT INTO group_members (id, group_id, user_identifier, joined_at)
		VALUES (?, ?, ?, ?)
	`, memberID, groupID, createdBy, now)
	if err != nil {
		// Rollback group creation if member addition fails
		s.db.GetConn().Exec("DELETE FROM groups WHERE id = ?", groupID)
		return fmt.Errorf("failed to add creator as member: %w", err)
	}

	return nil
}

// GetGroup retrieves a group by ID with all members
func (s *GroupService) GetGroup(groupID string) (*models.Group, []string, error) {
	group := &models.Group{}
	var description sql.NullString

	err := s.db.GetConn().QueryRow(`
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE id = ?
	`, groupID).Scan(
		&group.ID,
		&group.Slug,
		&group.Name,
		&description,
		&group.CreatedBy,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, fmt.Errorf("group not found")
		}
		return nil, nil, fmt.Errorf("failed to get group: %w", err)
	}

	if description.Valid {
		group.Description = description.String
	}

	// Get all members
	rows, err := s.db.GetConn().Query(`
		SELECT user_identifier
		FROM group_members
		WHERE group_id = ?
		ORDER BY joined_at ASC
	`, groupID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get group members: %w", err)
	}
	defer rows.Close()

	var memberIdentifiers []string
	for rows.Next() {
		var identifier string
		if err := rows.Scan(&identifier); err != nil {
			return nil, nil, fmt.Errorf("failed to scan member: %w", err)
		}
		memberIdentifiers = append(memberIdentifiers, identifier)
	}

	return group, memberIdentifiers, rows.Err()
}

// SearchGroup searches for a group by slug and checks if user is a member
func (s *GroupService) SearchGroup(slug, userIdentifier string) (*models.Group, []string, bool, error) {
	// Validate inputs
	if err := utils.ValidateGroupSlug(slug); err != nil {
		return nil, nil, false, err
	}
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return nil, nil, false, err
	}

	group := &models.Group{}
	var description sql.NullString

	err := s.db.GetConn().QueryRow(`
		SELECT id, slug, name, description, created_by, created_at, updated_at
		FROM groups
		WHERE slug = ?
	`, slug).Scan(
		&group.ID,
		&group.Slug,
		&group.Name,
		&description,
		&group.CreatedBy,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, false, fmt.Errorf("group not found")
		}
		return nil, nil, false, fmt.Errorf("failed to search group: %w", err)
	}

	if description.Valid {
		group.Description = description.String
	}

	// Check if user is a member
	var isMember bool
	err = s.db.GetConn().QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members 
			WHERE group_id = ? AND user_identifier = ?
		)
	`, group.ID, userIdentifier).Scan(&isMember)
	if err != nil {
		return nil, nil, false, fmt.Errorf("failed to check membership: %w", err)
	}

	// Get all members
	rows, err := s.db.GetConn().Query(`
		SELECT user_identifier
		FROM group_members
		WHERE group_id = ?
		ORDER BY joined_at ASC
	`, group.ID)
	if err != nil {
		return nil, nil, false, fmt.Errorf("failed to get group members: %w", err)
	}
	defer rows.Close()

	var memberIdentifiers []string
	for rows.Next() {
		var identifier string
		if err := rows.Scan(&identifier); err != nil {
			return nil, nil, false, fmt.Errorf("failed to scan member: %w", err)
		}
		memberIdentifiers = append(memberIdentifiers, identifier)
	}

	return group, memberIdentifiers, isMember, rows.Err()
}

// InviteToGroup adds a user to a group
func (s *GroupService) InviteToGroup(groupID, userIdentifier string, invitedBy string) error {
	// Validate inputs
	if err := utils.ValidateUserID(groupID); err != nil {
		return err
	}
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return err
	}
	if err := utils.ValidateUserIdentifier(invitedBy); err != nil {
		return err
	}

	// Check if group exists
	exists, err := s.authService.GroupExists(groupID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("group not found")
	}

	// Verify inviter is a member of the group
	isMember, err := s.authService.IsGroupMember(groupID, invitedBy)
	if err != nil {
		return err
	}
	if !isMember {
		return fmt.Errorf("only group members can invite users")
	}

	// Check if already a member
	var alreadyMember bool
	err = s.db.GetConn().QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members 
			WHERE group_id = ? AND user_identifier = ?
		)
	`, groupID, userIdentifier).Scan(&alreadyMember)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if alreadyMember {
		return fmt.Errorf("user is already a member")
	}

	// Add member
	memberID := utils.NewULID()
	now := utils.GetCurrentTimestamp()
	_, err = s.db.GetConn().Exec(`
		INSERT INTO group_members (id, group_id, user_identifier, joined_at)
		VALUES (?, ?, ?, ?)
	`, memberID, groupID, userIdentifier, now)
	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	return nil
}

// ListUserGroups lists all groups a user is a member of
func (s *GroupService) ListUserGroups(userIdentifier string) ([]*models.Group, [][]string, error) {
	// Validate inputs
	if err := utils.ValidateUserIdentifier(userIdentifier); err != nil {
		return nil, nil, err
	}

	rows, err := s.db.GetConn().Query(`
		SELECT g.id, g.slug, g.name, g.description, g.created_by, g.created_at, g.updated_at
		FROM groups g
		INNER JOIN group_members gm ON g.id = gm.group_id
		WHERE gm.user_identifier = ?
		ORDER BY g.created_at DESC
	`, userIdentifier)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list user groups: %w", err)
	}
	defer rows.Close()

	var groups []*models.Group
	var groupIDs []string

	for rows.Next() {
		group := &models.Group{}
		var description sql.NullString

		err := rows.Scan(
			&group.ID,
			&group.Slug,
			&group.Name,
			&description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to scan group: %w", err)
		}

		if description.Valid {
			group.Description = description.String
		}

		groups = append(groups, group)
		groupIDs = append(groupIDs, group.ID)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	// Get members for each group
	memberLists := make([][]string, len(groups))
	for i, groupID := range groupIDs {
		memberRows, err := s.db.GetConn().Query(`
			SELECT user_identifier
			FROM group_members
			WHERE group_id = ?
			ORDER BY joined_at ASC
		`, groupID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to get members for group %s: %w", groupID, err)
		}

		var members []string
		for memberRows.Next() {
			var identifier string
			if err := memberRows.Scan(&identifier); err != nil {
				memberRows.Close()
				return nil, nil, fmt.Errorf("failed to scan member: %w", err)
			}
			members = append(members, identifier)
		}
		memberRows.Close()

		memberLists[i] = members
	}

	return groups, memberLists, nil
}

// GroupExistsBySlug checks if a group with the given slug exists
// This is an efficient query using the indexed slug column
func (s *GroupService) GroupExistsBySlug(slug string) (bool, error) {
	var exists bool
	err := s.db.GetConn().QueryRow(`
		SELECT EXISTS(SELECT 1 FROM groups WHERE slug = ?)
	`, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check group existence: %w", err)
	}
	return exists, nil
}
