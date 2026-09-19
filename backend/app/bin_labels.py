"""Translate the verified bin meaning for users.

The data confirms Bin 1 means pass. Other bin numbers do not have a more
specific failure definition, so they are exposed as test failures rather than
internal labels such as ``bin2`` or ``bin3``.
"""
from __future__ import annotations

SOFT_BIN_LABELS: dict[int, str] = {1: "通過"}
HARD_BIN_LABELS: dict[int, str] = {1: "通過"}


def bin_label(bin_number: int) -> str:
    return SOFT_BIN_LABELS.get(bin_number, "測試失敗")


def hard_bin_label(bin_number: int) -> str:
    return HARD_BIN_LABELS.get(bin_number, "測試失敗")
