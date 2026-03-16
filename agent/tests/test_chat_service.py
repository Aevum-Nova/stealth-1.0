from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from stealth_agent.models import AgentConversation
from stealth_agent.services.chat import get_or_create_conversation


class _ScalarListResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return list(self._values)


class _Result:
    def __init__(self, *, scalar=None, scalars=None):
        self._scalar = scalar
        self._scalars = scalars or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return _ScalarListResult(self._scalars)


class _FakeSession:
    def __init__(self, *, conversations=None):
        self._conversations = conversations or []
        self.executed = []
        self.added = []
        self.deleted = []
        self.flush_calls = 0

    async def execute(self, statement):
        self.executed.append(statement)
        if len(self.executed) == 1:
            return _Result(scalars=self._conversations)
        return _Result()

    def add(self, value):
        self.added.append(value)

    async def delete(self, value):
        self.deleted.append(value)

    async def flush(self):
        self.flush_calls += 1


def _conversation(
    *,
    feature_request_id: uuid.UUID,
    organization_id: uuid.UUID,
    created_at: datetime,
) -> AgentConversation:
    return AgentConversation(
        id=uuid.uuid4(),
        feature_request_id=feature_request_id,
        organization_id=organization_id,
        created_at=created_at,
        updated_at=created_at,
    )


@pytest.mark.asyncio
async def test_get_or_create_conversation_merges_duplicate_rows():
    feature_request_id = uuid.uuid4()
    organization_id = uuid.uuid4()
    created_at = datetime.now(UTC)
    canonical = _conversation(
        feature_request_id=feature_request_id,
        organization_id=organization_id,
        created_at=created_at,
    )
    duplicate = _conversation(
        feature_request_id=feature_request_id,
        organization_id=organization_id,
        created_at=created_at + timedelta(seconds=1),
    )
    session = _FakeSession(conversations=[canonical, duplicate])

    conversation = await get_or_create_conversation(
        session,
        str(feature_request_id),
        str(organization_id),
    )

    assert conversation is canonical
    assert session.deleted == [duplicate]
    assert session.flush_calls == 1
    assert len(session.executed) == 2
    assert "UPDATE agent_messages" in str(session.executed[1])


@pytest.mark.asyncio
async def test_get_or_create_conversation_creates_new_row_when_missing():
    feature_request_id = uuid.uuid4()
    organization_id = uuid.uuid4()
    session = _FakeSession(conversations=[])

    conversation = await get_or_create_conversation(
        session,
        str(feature_request_id),
        str(organization_id),
    )

    assert conversation.feature_request_id == feature_request_id
    assert conversation.organization_id == organization_id
    assert session.added == [conversation]
    assert session.deleted == []
    assert session.flush_calls == 1
    assert len(session.executed) == 1
