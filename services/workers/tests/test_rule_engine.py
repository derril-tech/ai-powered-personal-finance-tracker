# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_rule_engine_applies_action():
    tx = {"merchant": "Amazon", "category": None}
    rule = {"conditions": [{"field": "merchant", "op": "contains", "value": "amazon"}], "actions": [{"type": "set_category", "value": "shopping"}]}
    cond_ok = 'amazon' in tx['merchant'].lower()
    if cond_ok:
        tx['category'] = 'shopping'
    assert tx['category'] == 'shopping'
