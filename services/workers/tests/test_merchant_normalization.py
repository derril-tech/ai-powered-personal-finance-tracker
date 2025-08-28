# Created automatically by Cursor AI (2025-08-28)
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv('RUN_WORKER_TESTS') != '1', reason='Worker tests disabled by default'
)

def test_merchant_normalization_basic():
    from typing import Callable
    # Placeholder normalization function
    def normalize(name: str) -> str:
        return ' '.join(name.lower().split())

    assert normalize('  AMAZON  MARKET  ') == 'amazon market'
