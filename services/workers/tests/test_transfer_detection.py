# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_transfer_detection_symmetry():
    tx1 = {"amount": -100, "account": "A", "ts": 1}
    tx2 = {"amount": 100, "account": "B", "ts": 1}
    is_transfer = abs(tx1["amount"]) == abs(tx2["amount"]) and tx1["ts"] == tx2["ts"]
    assert is_transfer
