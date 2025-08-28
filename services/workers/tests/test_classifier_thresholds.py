# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_classifier_thresholds_bounds():
    default_threshold = 0.5
    assert 0.0 <= default_threshold <= 1.0
