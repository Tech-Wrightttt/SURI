"""Read-only account API regressions without database or external services."""

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth import get_current_student
from backend.routes.auth_routes import router


class AccountDetailsTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_student] = lambda: {
            "id": "student", "name": "Alex Student", "email": "alex@example.com",
            "grade_level": 9, "created_at": "2026-01-01T00:00:00Z",
            "password_hash": "private-hash",
        }
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_account_details_exclude_password(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "student_id": "student", "name": "Alex Student", "email": "alex@example.com",
            "grade_level": 9, "created_at": "2026-01-01T00:00:00Z",
        })

    def test_account_editing_routes_are_unavailable(self):
        for method, route in [("patch", "profile"), ("patch", "email"), ("post", "password")]:
            with self.subTest(route=route):
                response = getattr(self.client, method)(f"/api/auth/{route}", json={})
                self.assertEqual(response.status_code, 404)

    def test_logout_clears_auth_cookie(self):
        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token=", response.headers["set-cookie"])
        self.assertIn("Max-Age=0", response.headers["set-cookie"])


if __name__ == "__main__":
    unittest.main()
