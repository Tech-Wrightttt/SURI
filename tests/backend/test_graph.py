"""Module 3 — Prerequisite Graph Engine (backend/graph.py, backend/routes/graph_routes.py)."""

from backend.competency_utils import get_chain
from backend.graph import (
    DEEPEST_NODES,
    ENTRY_NODES,
    GRAPH,
    find_next_node_toward_entry,
    get_next_node_toward_entry,
    get_prerequisite_path,
    node_leads_to_entry,
)


async def test_TC11_chain_preview_for_valid_topic(client, db):
    res = await client.get("/api/graph/QE/chain")

    assert res.status_code == 200
    body = res.json()
    assert body["topic_entry_node"] == "QE"
    assert [n["node_id"] for n in body["chain"]] == ["QE", "FP", "SP", "LE", "OI", "FD"]
    assert body["chain"][0] == {"node_id": "QE", "node_label": "Quadratic Equations", "grade": 9}


async def test_TC12_chain_preview_for_unknown_topic(client, db):
    res = await client.get("/api/graph/INVALID_TOPIC/chain")

    assert res.status_code == 404
    assert res.json()["detail"] == "Topic not found"


def test_TC13_find_next_node_toward_entry_walks_upward():
    assert find_next_node_toward_entry("OI", "QE") == "LE"
    # LE has two dependents (SP, RER); the entry's chain decides which one.
    assert find_next_node_toward_entry("LE", "RER") == "RER"
    assert find_next_node_toward_entry("FD", "SLE") == "RPP"
    # No dependent of PD leads to PE.
    assert find_next_node_toward_entry("PD", "PE") is None


def test_TC14_find_next_node_toward_entry_at_entry_is_none():
    assert find_next_node_toward_entry("QE", "QE") is None


def test_TC67_graph_is_a_consistent_acyclic_dag():
    assert len(GRAPH) == 15
    assert ENTRY_NODES == ["SLE", "RER", "QE", "PE"]
    assert sorted(DEEPEST_NODES) == ["FD", "PO"]
    for node_id, node in GRAPH.items():
        prereq = node["prerequisite"]
        if prereq is not None:
            assert prereq in GRAPH
            assert node_id in GRAPH[prereq]["dependents"], f"{prereq} must list {node_id}"
        for dep in node["dependents"]:
            assert GRAPH[dep]["prerequisite"] == node_id
    # Every chain terminates at a floor node without revisiting a node.
    for entry in GRAPH:
        chain = get_chain(entry)
        assert len(chain) == len(set(chain))
        assert GRAPH[chain[-1]]["prerequisite"] is None
    assert get_chain("SLE") == ["SLE", "L2V", "L1V", "AE", "RPP", "FD"]
    assert get_chain("RER") == ["RER", "LE", "OI", "FD"]
    assert get_chain("PE") == ["PE", "PO"]


def test_TC68_upward_path_helpers():
    assert get_prerequisite_path("FD", "QE") == ["FD", "OI", "LE", "SP", "FP", "QE"]
    assert get_prerequisite_path("QE", "QE") == ["QE"]
    assert get_next_node_toward_entry("SP", "QE") == "FP"
    assert get_next_node_toward_entry("PD", "QE") is None
    assert node_leads_to_entry("FD", "SLE") is True
    assert node_leads_to_entry("RER", "QE") is False
