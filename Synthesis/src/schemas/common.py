from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T


class ApiError(BaseModel):
    success: bool = False
    error: dict[str, str]


class Pagination(BaseModel):
    page: int
    limit: int
    total: int


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    pagination: Pagination
