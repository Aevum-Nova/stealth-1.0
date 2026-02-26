from __future__ import annotations

import aioboto3
import structlog

from src.config import settings


class R2Service:
    def __init__(self) -> None:
        self._session = aioboto3.Session()

    @property
    def _is_configured(self) -> bool:
        return bool(settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY)

    async def upload(self, key: str, body: bytes, content_type: str) -> dict:
        if not self._is_configured:
            return {"key": key, "size": len(body)}

        async with self._session.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        ) as client:
            try:
                await client.put_object(
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=key,
                    Body=body,
                    ContentType=content_type,
                )
            except Exception as exc:
                # Keep ingestion usable in local/dev when object storage creds are missing or invalid.
                structlog.get_logger().warning(
                    "r2_upload_failed_falling_back",
                    key=key,
                    bucket=settings.R2_BUCKET_NAME,
                    error=str(exc),
                )
                return {"key": key, "size": len(body)}

        return {"key": key, "size": len(body)}

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        if not self._is_configured:
            return f"r2://{settings.R2_BUCKET_NAME}/{key}"

        async with self._session.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        ) as client:
            try:
                return await client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
                    ExpiresIn=expires_in,
                )
            except Exception as exc:
                structlog.get_logger().warning(
                    "r2_presign_failed_falling_back",
                    key=key,
                    bucket=settings.R2_BUCKET_NAME,
                    error=str(exc),
                )
                return f"r2://{settings.R2_BUCKET_NAME}/{key}"

    async def delete(self, key: str) -> None:
        if not self._is_configured:
            return

        async with self._session.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        ) as client:
            try:
                await client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
            except Exception as exc:
                structlog.get_logger().warning(
                    "r2_delete_failed_ignored",
                    key=key,
                    bucket=settings.R2_BUCKET_NAME,
                    error=str(exc),
                )


r2_service = R2Service()
