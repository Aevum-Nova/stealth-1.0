from __future__ import annotations

import asyncio
import time

import httpx

from src.config import settings


class AssemblyAIService:
    BASE_URL = "https://api.assemblyai.com/v2"

    def __init__(self) -> None:
        self._api_key = settings.ASSEMBLYAI_API_KEY

    async def transcribe(self, audio_bytes: bytes) -> str:
        if not self._api_key:
            return "Speaker A: Transcription unavailable (ASSEMBLYAI_API_KEY not configured)."

        headers = {"authorization": self._api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            upload_resp = await client.post(
                f"{self.BASE_URL}/upload",
                headers=headers,
                content=audio_bytes,
            )
            upload_resp.raise_for_status()
            upload_url = upload_resp.json()["upload_url"]

            transcript_resp = await client.post(
                f"{self.BASE_URL}/transcript",
                headers={**headers, "content-type": "application/json"},
                json={
                    "audio_url": upload_url,
                    "speaker_labels": True,
                    "language_detection": True,
                },
            )
            transcript_resp.raise_for_status()
            transcript_id = transcript_resp.json()["id"]

            start = time.monotonic()
            poll_seconds = 3
            while True:
                if time.monotonic() - start > 600:
                    raise TimeoutError("Transcription timed out.")

                poll_resp = await client.get(f"{self.BASE_URL}/transcript/{transcript_id}", headers=headers)
                poll_resp.raise_for_status()
                payload = poll_resp.json()
                status = payload.get("status")
                if status == "completed":
                    utterances = payload.get("utterances") or []
                    if utterances:
                        return "\n".join(
                            f"Speaker {u.get('speaker', '?')}: {u.get('text', '').strip()}" for u in utterances
                        )
                    return payload.get("text", "")
                if status == "error":
                    raise RuntimeError(payload.get("error", "AssemblyAI transcription failed"))

                await asyncio.sleep(poll_seconds)
                poll_seconds = min(poll_seconds + 1, 10)


assemblyai_service = AssemblyAIService()
