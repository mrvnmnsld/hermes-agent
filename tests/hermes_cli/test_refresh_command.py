"""``/refresh``: the registry entry (no name clash) and the classic CLI handler."""

from unittest.mock import MagicMock, patch

import pytest

from hermes_cli import commands


def _make_cli(*, surface="cli", history=(), agent=None):
    from hermes_cli.cli_info_mixin import CLIInfoMixin
    from hermes_cli.cli_loops_mixin import CLILoopsMixin
    from hermes_cli.cli_session_mixin import CLISessionMixin

    class _Cli(CLILoopsMixin, CLIInfoMixin, CLISessionMixin):
        pass

    obj = object.__new__(_Cli)
    obj._slash_metrics_surface = surface
    obj._command_running = False
    obj.conversation_history = list(history)
    obj.agent = agent
    return obj


@pytest.fixture
def wired():
    """A CLI whose reload/new/compress steps are recorded; reload succeeds unless a test flips it."""
    cli = _make_cli()
    cli.calls = []
    cli.reload_ok = True
    cli._busy_command = lambda *_a, **_k: MagicMock(__enter__=lambda s: s, __exit__=lambda *a: False)
    cli._slow_command_status = lambda _c: "busy"
    cli._reload_skills = lambda: (cli.calls.append("reload"), cli.reload_ok)[1]
    cli._cmd_new = lambda cmd: cli.calls.append(("new", cmd))
    cli._manual_compress = lambda cmd="": cli.calls.append(("compress", cmd))
    return cli


class TestRegistry:
    def test_refresh_is_a_single_builtin_with_no_alias_clash(self):
        owners = [c.name for c in commands.COMMAND_REGISTRY if "refresh" in (c.name, *c.aliases)]
        assert owners == ["refresh"]
        assert commands.resolve_command("refresh").name == "refresh"

    def test_listed_for_autocomplete_and_the_gateway(self):
        assert "refresh" in commands.GATEWAY_KNOWN_COMMANDS
        assert any(c.name == "refresh" for c in commands.COMMAND_REGISTRY if not c.cli_only)

    def test_a_plugin_cannot_shadow_it(self, caplog):
        from hermes_cli.plugins import PluginContext, PluginManager, PluginManifest

        ctx = PluginContext(PluginManifest(name="shadow"), PluginManager())
        assert ctx.register_command("refresh", lambda _a: "x") is None


class TestCliHandler:
    def test_plain_form_reloads_then_starts_new_session(self, wired):
        assert wired._cmd_refresh("/refresh") is True
        assert wired.calls == ["reload", ("new", "/new")]

    def test_keep_form_reloads_then_compresses_without_new_session(self, wired):
        wired._cmd_refresh("/refresh keep")
        assert wired.calls == ["reload", ("compress", "/compress")]

    def test_failed_reload_stops_everything(self, wired, capsys):
        wired.reload_ok = False
        for text in ("/refresh", "/refresh keep"):
            wired._cmd_refresh(text)
        assert wired.calls == ["reload", "reload"]
        assert "nothing else was done" in capsys.readouterr().out

    def test_unknown_argument_does_nothing(self, wired, capsys):
        wired._cmd_refresh("/refresh title")
        assert wired.calls == []
        assert "Usage: /refresh" in capsys.readouterr().out

    def test_tui_slash_worker_never_claims_to_reset_the_tui_session(self, wired, capsys):
        wired._slash_metrics_surface = None
        wired._cmd_refresh("/refresh")
        assert wired.calls == []
        assert "/reload-skills" in capsys.readouterr().out

    def test_keep_on_a_short_context_prints_the_compress_skip_and_runs_no_model(self, capsys):
        cli = _make_cli(history=[{"role": "user", "content": "hi"}], agent=MagicMock())
        cli._busy_command = lambda *_a, **_k: MagicMock(__enter__=lambda s: s, __exit__=lambda *a: False)
        cli._slow_command_status = lambda _c: "busy"
        cli._reload_skills = lambda: True
        cli._cmd_refresh("/refresh keep")
        out = capsys.readouterr().out
        assert "too short" in out.lower() or "not enough" in out.lower()
        cli.agent.run_conversation.assert_not_called()


def test_reload_skills_reports_success_and_failure():
    cli = _make_cli()
    with patch("hermes_cli.gateway_tools.process_view", return_value=None), \
         patch("agent.skill_commands.reload_skills", return_value={"added": [], "removed": [], "total": 2}):
        assert cli._reload_skills() is True
    with patch("hermes_cli.gateway_tools.process_view", return_value=None), \
         patch("agent.skill_commands.reload_skills", side_effect=RuntimeError("x")):
        assert cli._reload_skills() is False
