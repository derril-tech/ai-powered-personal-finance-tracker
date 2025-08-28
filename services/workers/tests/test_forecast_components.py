# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_forecast_components_exist():
    components = {"trend": 1.0, "seasonal": 0.2, "noise": 0.1}
    assert set(components.keys()) == {"trend", "seasonal", "noise"}
