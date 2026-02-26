from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=255)
    organization_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class OrganizationInfo(BaseModel):
    id: UUID
    name: str


class AuthUser(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    role: str
    organization_id: UUID


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str


class AuthPayload(BaseModel):
    user: AuthUser
    organization: OrganizationInfo | None = None
    access_token: str
    refresh_token: str


class MePayload(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    role: str
    organization: OrganizationInfo
    created_at: datetime
