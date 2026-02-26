from __future__ import annotations

from src.processors.text import text_processor
from src.services.llm import llm_service


class ImageProcessor:
    async def process(self, image_bytes: bytes, mime_type: str) -> dict:
        extracted = await llm_service.vision_to_text(image_bytes, mime_type)
        text_result = await text_processor.process(extracted)
        return {
            "extracted_text": extracted,
            "structured_summary": text_result["structured_summary"],
            "entities": text_result["entities"],
            "sentiment": text_result["sentiment"],
            "urgency": text_result["urgency"],
            "embedding": text_result["embedding"],
        }


image_processor = ImageProcessor()
