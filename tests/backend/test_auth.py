"""Module 1 — Authentication & Identity (backend/routes/auth_routes.py, backend/auth.py)."""

import bcrypt
import pytest

from helpers import DEFAULT_PASSWORD, make_student

REGISTER = {
    "name": "Juan Dela Cruz",
    "email": "juan@cit.edu",
    "grade_level": 7,
    "password": DEFAULT_PASSWORD,
}


async def test_TC01_register_valid_student(client, db):
    res = await client.post("/api/auth/register", json=REGISTER)

    assert res.status_code == 201
    body = res.json()
    assert body["student_id"] and body["token"]
    cookie = res.headers["set-cookie"].lower()
    assert "access_token=" in cookie and "httponly" in cookie
    assert "path=/" in cookie and "samesite=lax" in cookie
    row = await db.fetchrow("SELECT * FROM students WHERE email = 'juan@cit.edu'")
    assert row["id"] == body["student_id"] and row["grade_level"] == 7
    assert row["password_hash"] != DEFAULT_PASSWORD
    assert bcrypt.checkpw(DEFAULT_PASSWORD.encode(), row["password_hash"].encode())


async def test_TC02_login_valid_credentials(client, db):
    student = await make_student(db, email="juan@cit.edu")

    res = await client.post("/api/auth/login",
                            json={"email": "juan@cit.edu", "password": DEFAULT_PASSWORD})

    assert res.status_code == 200
    assert res.json()["student_id"] == student["id"]
    cookie = res.headers["set-cookie"].lower()
    assert "access_token=" in cookie and "max-age=604800" in cookie


async def test_TC03_login_unknown_email(client, db):
    res = await client.post("/api/auth/login",
                            json={"email": "nonexistent@cit.edu", "password": "AnyPassword"})

    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"
    assert "set-cookie" not in res.headers


async def test_TC04_login_wrong_password(client, db):
    await make_student(db, email="juan@cit.edu")

    res = await client.post("/api/auth/login",
                            json={"email": "juan@cit.edu", "password": "WrongPassword"})

    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"
    assert "set-cookie" not in res.headers


async def test_TC05_register_duplicate_email(client, db):
    await make_student(db, email="juan@cit.edu")

    res = await client.post("/api/auth/register", json=REGISTER)

    assert res.status_code == 409
    assert res.json()["detail"] == "A student with that email already exists"
    assert await db.fetchval("SELECT COUNT(*) FROM students") == 1


async def test_TC06_logout_clears_cookie(client, db):
    student = await make_student(db)
    client.cookies.set("access_token", student["token"])

    res = await client.post("/api/auth/logout")

    assert res.status_code == 200
    assert res.json() == {"message": "Logged out successfully"}
    cookie = res.headers["set-cookie"].lower()
    assert "access_token=" in cookie and "max-age=0" in cookie


@pytest.mark.parametrize("grade", [6, 11])
async def test_TC51_register_rejects_grade_outside_7_to_10(client, db, grade):
    res = await client.post("/api/auth/register",
                            json={**REGISTER, "email": f"g{grade}@cit.edu", "grade_level": grade})

    assert res.status_code == 422
    assert await db.fetchval("SELECT COUNT(*) FROM students") == 0


async def test_TC52_register_accepts_grade_boundaries_7_and_10(client, db):
    for grade in (7, 10):
        res = await client.post("/api/auth/register",
                                json={**REGISTER, "email": f"g{grade}@cit.edu", "grade_level": grade})
        assert res.status_code == 201


async def test_TC53_me_returns_profile_from_cookie(client, db):
    student = await make_student(db, email="juan@cit.edu", grade_level=9)
    client.cookies.set("access_token", student["token"])

    res = await client.get("/api/auth/me")

    assert res.status_code == 200
    body = res.json()
    assert body["student_id"] == student["id"]
    assert body["email"] == "juan@cit.edu" and body["grade_level"] == 9


@pytest.mark.parametrize("headers, detail", [
    ({}, "Not authenticated"),
    ({"Authorization": "Bearer not-a-jwt"}, "Invalid or expired token"),
])
async def test_TC54_protected_route_rejects_missing_or_invalid_token(client, db, headers, detail):
    res = await client.get("/api/auth/me", headers=headers)

    assert res.status_code == 401
    assert res.json()["detail"] == detail
