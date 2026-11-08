from tools.delegate_tool import DELEGATE_TASK_SCHEMA
from tools.delegate_tool_tasks import short_task_name


def test_explicit_name_wins_and_is_capped():
    assert short_task_name("Check live deploy status", "Long goal text") == "Check live deploy status"
    assert len(short_task_name("x" * 90, "goal")) == 40


def test_goal_fallback_takes_first_four_words_without_markdown():
    goal = "**Check** the `live` deploy status of KB-039 and report"
    assert short_task_name(None, goal) == "Check the live deploy"
    assert short_task_name("  ", "KB-039 recon now please") == "KB-039 recon now please"


def test_core_display_fields_are_not_refused_as_undeclared_by_a_backend():
    from agent.delegation_provider import RESERVED_TASK_PARAMETERS

    assert {"name", "worker"} <= RESERVED_TASK_PARAMETERS


def test_schema_offers_optional_name():
    item = DELEGATE_TASK_SCHEMA["parameters"]["properties"]["tasks"]["items"]
    assert item["properties"]["name"]["maxLength"] == 40
    assert "name" not in item["required"]
