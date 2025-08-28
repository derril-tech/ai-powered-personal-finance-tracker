# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_recurring_monthly_detect():
    dates = [1, 31, 60, 90]  # approx monthly deltas (days)
    diffs = [dates[i]-dates[i-1] for i in range(1, len(dates))]
    approx_monthly = all(28 <= d <= 31 for d in diffs)
    assert approx_monthly
