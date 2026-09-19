"""Bin names: official SmarTest bin table only.

Bin 1 is "passed"; every other bin is "bin2" ... "bin32"
(SmarTest/Case_Smt870/src/common/DefineBins.java, also printed in py-app.log).
No document gives richer meanings, so none are invented here. Add real
definitions when confirmed (and mirror them in frontend/src/lib/binLabels.ts).
"""
from __future__ import annotations

SOFT_BIN_LABELS: dict[int, str] = {1: "passed"}
HARD_BIN_LABELS: dict[int, str] = {1: "passed"}


def bin_label(bin_number: int) -> str:
    return SOFT_BIN_LABELS.get(bin_number, f"bin{bin_number}")


def hard_bin_label(bin_number: int) -> str:
    return HARD_BIN_LABELS.get(bin_number, f"bin{bin_number}")
