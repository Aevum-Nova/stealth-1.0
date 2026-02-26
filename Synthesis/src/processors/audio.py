from __future__ import annotations

from src.processors.text import text_processor
from src.services.assemblyai import assemblyai_service


class AudioProcessor:
    async def process(self, audio_bytes: bytes) -> dict:
        transcript = await assemblyai_service.transcribe(audio_bytes)
        text_result = await text_processor.process(transcript)
        return {
            "transcript": transcript,
            "structured_summary": text_result["structured_summary"],
            "entities": text_result["entities"],
            "sentiment": text_result["sentiment"],
            "urgency": text_result["urgency"],
            "embedding": text_result["embedding"],
        }


audio_processor = AudioProcessor()
