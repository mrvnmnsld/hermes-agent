from tui_gateway.tool_progress import _subagent_payload


def test_worker_name_and_provider_reach_the_subagent_event():
    kw = {"goal": "Run git status", "task_count": 1, "worker": "ops", "name": "Check hub status", "provider": "nous"}

    payload = _subagent_payload("subagent.start", None, None, kw, show_reasoning=False)

    assert payload["worker"] == "ops"
    assert payload["name"] == "Check hub status"
    assert payload["provider"] == "nous"


def test_identity_fields_are_omitted_when_the_emitter_does_not_send_them():
    payload = _subagent_payload("subagent.start", None, None, {"goal": "Run git status"}, show_reasoning=False)

    assert not {"worker", "name", "provider"} & payload.keys()
