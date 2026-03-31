import unittest

from app.core.permissions import (
    VER_AGENDA_PROPIA,
    VER_BASE_CLIENTES,
    effective_permissions,
    is_platform_admin,
    member_branch_scope,
    normalize_global_role,
    normalize_store_member_role,
)
from app.models.store import StoreMemberRole
from app.models.user import UserRole


class DummyMember:
    def __init__(self, role: StoreMemberRole, permissions=None, branch_ids=None):
        self.role = role
        self.permissions = permissions
        self.branch_ids = branch_ids


class RbacContractTests(unittest.TestCase):
    def test_global_role_legacy_mapping(self):
        self.assertEqual(normalize_global_role(UserRole.ADMIN), "platform_admin")
        self.assertEqual(normalize_global_role(UserRole.OPERATOR), "platform_operator")
        self.assertTrue(is_platform_admin(UserRole.ADMIN))

    def test_store_role_legacy_mapping(self):
        self.assertEqual(normalize_store_member_role(StoreMemberRole.ADMIN), "store_admin")
        self.assertEqual(normalize_store_member_role(StoreMemberRole.SELLER), "branch_admin")
        self.assertEqual(normalize_store_member_role(StoreMemberRole.OPERATOR), "worker")

    def test_worker_default_permissions(self):
        member = DummyMember(StoreMemberRole.WORKER)
        perms = effective_permissions(member)
        self.assertIn(VER_AGENDA_PROPIA, perms)
        self.assertNotIn(VER_BASE_CLIENTES, perms)

    def test_permission_override_priority(self):
        member = DummyMember(StoreMemberRole.ADMIN, permissions=["custom_perm"])
        self.assertEqual(effective_permissions(member), frozenset({"custom_perm"}))

    def test_branch_scope_normalization(self):
        member = DummyMember(StoreMemberRole.BRANCH_ADMIN, branch_ids=["b1", "", "b2"])
        self.assertEqual(member_branch_scope(member), frozenset({"b1", "b2"}))


if __name__ == "__main__":
    unittest.main()

