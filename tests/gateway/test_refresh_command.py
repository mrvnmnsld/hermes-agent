"""``/refresh`` on the messaging gateway: reload skills, then a new session (``/refresh keep``: compress
the current session instead). Direct handlers only; no agent turn runs."""

from unittest.mock import AsyncMock

import pytest

from gateway.config import Platform
from gateway.platforms.event import MessageEvent
from gateway.run_busy import GatewayBusySessionMixin
from gateway.session import SessionSource
from gateway.slash_commands import GatewaySlashCommandsMixin



class _Runner(GatewaySlashCommandsMixin, GatewayBusySessionMixin):
    """Just the slash-command handlers: no sessions, adapters or agent are wired."""

    adapters: dict = {}

    def _session_key_for_source(self, _source):
        return "key"

    async def _run_in_executor_with_context(self, fn, *args):
        return fn(*args)


def _make_event(text):
    source = SessionSource(platform=Platform.TELEGRAM, user_id="u1", chat_id="c1", user_name="t", chat_type="dm")
    return MessageEvent(text=text, source=source, message_id="m1")


def _make_runner():
    return _Runner()


_OK = {"added": [], "removed": [], "unchanged": [], "total": 5, "commands": 5}


@pytest.fixture
def runner(monkeypatch):
    from agent import skill_commands

    monkeypatch.setattr(skill_commands, "reload_skills", lambda: _OK)
    r = _make_runner()
    r._handle_reset_command = AsyncMock(return_value="NEW-SESSION")
    r._handle_compress_command = AsyncMock(return_value="COMPRESSED")
    r._run_agent = AsyncMock(side_effect=AssertionError("/refresh must not start a model turn"))
    return r


@pytest.mark.asyncio
async def test_plain_refresh_reloads_then_starts_new_session(runner):
    out = await runner._handle_refresh_command(_make_event("/refresh"))

    assert "5 skill(s) available" in out and out.endswith("NEW-SESSION")
    runner._handle_reset_command.assert_awaited_once()
    runner._handle_compress_command.assert_not_awaited()
    runner._run_agent.assert_not_called()


@pytest.mark.asyncio
async def test_refresh_keep_compresses_and_never_resets(runner):
    out = await runner._handle_refresh_command(_make_event("/refresh keep"))

    assert out.endswith("COMPRESSED")
    runner._handle_reset_command.assert_not_awaited()
    # The "keep" token must not leak into /compress as its focus topic.
    follow = runner._handle_compress_command.await_args.args[0]
    assert follow.get_command_args() == ""


@pytest.mark.asyncio
async def test_keep_passes_through_the_compress_skip_message_when_context_is_small(runner):
    runner._handle_compress_command = AsyncMock(return_value="Not enough conversation to compress")

    out = await runner._handle_refresh_command(_make_event("/refresh keep"))

    assert "Skills Reloaded" in out and "Not enough conversation to compress" in out


@pytest.mark.asyncio
async def test_failed_reload_stops_before_anything_is_dropped(runner, monkeypatch):
    from agent import skill_commands

    def boom():
        raise RuntimeError("disk gone")

    monkeypatch.setattr(skill_commands, "reload_skills", boom)

    for text in ("/refresh", "/refresh keep"):
        out = await runner._handle_refresh_command(_make_event(text))
        assert "disk gone" in out and "nothing else was done" in out
    runner._handle_reset_command.assert_not_awaited()
    runner._handle_compress_command.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_argument_is_refused_without_side_effects(runner):
    out = await runner._handle_refresh_command(_make_event("/refresh my-title"))

    assert out.startswith("Usage: /refresh")
    runner._handle_reset_command.assert_not_awaited()


def test_gateway_dispatches_refresh_to_its_handler():
    runner = _make_runner()

    handlers = runner._gateway_idle_command_handlers()

    assert handlers["refresh"].__func__ is type(runner)._handle_refresh_command
