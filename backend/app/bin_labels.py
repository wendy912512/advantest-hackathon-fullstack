"""Soft Bin label lookup.

Bin 1 is PASS; the rest are demo failure categories (real bin definitions
need to come from the test engineer / SmarTest bin table — see the Notion
alignment doc). Kept in sync by hand with
frontend/src/lib/binLabels.ts — don't let one side show the real reason
while the other still shows a bare "Bin 2".
"""
from __future__ import annotations

SOFT_BIN_LABELS: dict[int, str] = {
    1: "Pass",
    2: "Leakage Fail",
    3: "Timing Fail",
    4: "Functional Fail",
}


def bin_label(bin_number: int) -> str:
    return SOFT_BIN_LABELS.get(bin_number, f"Bin {bin_number}（未定義）")
