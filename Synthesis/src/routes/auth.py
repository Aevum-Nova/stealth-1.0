from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_user
from src.models.user import Organization, RefreshToken, User
from src.schemas.auth import LoginRequest, MePayload, RefreshRequest, RegisterRequest
from src.schemas.common import ApiResponse
from src.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=ApiResponse[dict])
async def register(payload: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    org = Organization(name=payload.organization_name)
    db.add(org)
    await db.flush()

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        name=payload.name,
        organization_id=org.id,
        role="admin",
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(str(user.id), str(org.id), user.role)
    refresh_token, token_hash, expires_at, family = create_refresh_token(str(user.id))

    db.add(
        RefreshToken(
            user_id=user.id,
            token_family=UUID(family),
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    await db.commit()

    _set_refresh_cookie(response, refresh_token)
    return ApiResponse(
        data={
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "organization_id": str(user.organization_id),
            },
            "organization": {"id": str(org.id), "name": org.name},
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    )


@router.post("/login", response_model=ApiResponse[dict])
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(str(user.id), str(user.organization_id), user.role)
    refresh_token, token_hash, expires_at, family = create_refresh_token(str(user.id))

    db.add(
        RefreshToken(
            user_id=user.id,
            token_family=UUID(family),
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    await db.commit()

    _set_refresh_cookie(response, refresh_token)
    return ApiResponse(
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "organization_id": str(user.organization_id),
            },
        }
    )


@router.post("/refresh", response_model=ApiResponse[dict])
async def refresh_token(
    payload: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
):
    raw_token = payload.refresh_token or refresh_cookie
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")

    try:
        decoded = decode_refresh_token(raw_token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    token_result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    token_record = token_result.scalar_one_or_none()

    family_id = UUID(str(decoded["family"]))
    if token_record is None or token_record.revoked_at is not None:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_family == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_result = await db.execute(select(User).where(User.id == token_record.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_record.revoked_at = datetime.now(timezone.utc)
    new_refresh, new_hash, expires_at, _ = create_refresh_token(str(user.id), token_family=str(family_id))
    db.add(
        RefreshToken(
            user_id=user.id,
            token_family=family_id,
            token_hash=new_hash,
            expires_at=expires_at,
        )
    )

    access = create_access_token(str(user.id), str(user.organization_id), user.role)
    await db.commit()

    _set_refresh_cookie(response, new_refresh)
    return ApiResponse(data={"access_token": access, "refresh_token": new_refresh})


@router.post("/logout", response_model=ApiResponse[dict])
async def logout(
    payload: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
):
    raw_token = payload.refresh_token or refresh_cookie
    if raw_token:
        try:
            decoded = decode_refresh_token(raw_token)
            family_id = UUID(str(decoded["family"]))
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.token_family == family_id, RefreshToken.revoked_at.is_(None))
                .values(revoked_at=datetime.now(timezone.utc))
            )
            await db.commit()
        except jwt.InvalidTokenError:
            pass

    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return ApiResponse(data={"logged_out": True})


@router.get("/me", response_model=ApiResponse[MePayload])
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    organization = org_result.scalar_one_or_none()
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return ApiResponse(
        data=MePayload(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            organization={"id": organization.id, "name": organization.name},
            created_at=user.created_at,
        )
    )
