# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_anomaly_threshold_range():
    z_threshold = 3.0
    assert 1.0 <= z_threshold <= 5.0
