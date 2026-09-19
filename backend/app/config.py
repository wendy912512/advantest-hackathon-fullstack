from dataclasses import dataclass, field


@dataclass(frozen=True)
class RuleConfig:
    """閾值集中管理；不要把資料集特定假設散落在規則程式裡。"""

    yield_threshold: float = 0.80
    yield_min_samples: int = 20
    # Training CSV 的 SBin 6 是已確認能對應低良率的 failure bin；實際 ONEAPI
    # 上線前應用測試程式的 bin mapping 覆蓋此設定。
    bad_soft_bins: frozenset[int] = field(default_factory=lambda: frozenset({6}))
    site_min_samples: int = 5
    site_p_value: float = 0.01
    site_sigma: float = 3.0
    site_yield_difference: float = 0.10
    trend_min_points: int = 8
    # Recalculate trend after every complete device.
    trend_batch_size: int = 1
    trend_r2: float = 0.70
    trend_confirmations: int = 2
    stdev_window: int = 8
    # RawResult 的列順序是測試流程順序，訓練標籤把「Mean Trend Up」標在
    # 從高到低的資料方向；即時 ONEAPI 應改用 test timestamp 後再確認方向。
    mean_trend_up_when_slope_negative: bool = True
    aggregate_mean_normalized_slope: float = 0.00004
    aggregate_stdev_normalized_slope: float = 0.00001
    profile_stdev_r2: float = 0.2
    profile_stdev_normalized_slope: float = 0.0003
    alert_cooldown_seconds: float = 30.0
