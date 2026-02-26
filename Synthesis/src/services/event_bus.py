import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

    def subscribe(self, org_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers[org_id].append(queue)
        return queue

    def unsubscribe(self, org_id: str, queue: asyncio.Queue) -> None:
        try:
            self._subscribers[org_id].remove(queue)
        except (KeyError, ValueError):
            return

    async def publish(self, org_id: str, event_type: str, data: dict) -> None:
        for queue in list(self._subscribers.get(org_id, [])):
            try:
                queue.put_nowait({"event": event_type, "data": data})
            except asyncio.QueueFull:
                continue


_event_bus = EventBus()


def get_event_bus() -> EventBus:
    return _event_bus
