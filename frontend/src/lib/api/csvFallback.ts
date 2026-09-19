import type {
  SensorStage,
  ThermalStatus,
  ThermalVerdict,
  WaferFails,
  WaferMapData,
  WaferThermal,
} from "./types";
import thermalFixture from "./thermalFixture.json";
import failFixtures from "./failFixtures.json";
import waferMapFixtures from "./waferMapFixtures.json";

type FixtureMap = Record<string, WaferMapData>;
type FailFixture = { events: WaferFails["events"]; rows: WaferFails["rows"] };

const LIVE_LOT = "A12345";

export function getCsvWaferMap(lot: string, wafer: string): WaferMapData | undefined {
  if (lot !== LIVE_LOT) return undefined;
  const fixture = (waferMapFixtures as FixtureMap)[wafer];
  return fixture ? { ...fixture, lot, wafer } : undefined;
}

export function getCsvWaferFails(lot: string, wafer: string): WaferFails | undefined {
  if (lot !== LIVE_LOT) return undefined;
  const fixture = (failFixtures as Record<string, FailFixture>)[wafer];
  return fixture ? { lot, wafer, events: fixture.events, rows: fixture.rows } : undefined;
}

const COMPLETED_SENSORS = 3;

function classify(value: number | null, upper: number | null): ThermalStatus {
  if (value === null || upper === null) return "pending";
  if (value >= upper) return "critical";
  if (value >= upper - thermalFixture.warnMargin) return "warning";
  return "normal";
}

function verdict(status: ThermalStatus, actual: number | null, upper: number | null): ThermalVerdict | null {
  if (actual === null || upper === null || status === "pending") return null;
  const predictedAlarm = status !== "normal";
  const actualAlarm = classify(actual, upper) !== "normal";
  if (predictedAlarm && actualAlarm) return "hit";
  if (predictedAlarm) return "false_alarm";
  if (actualAlarm) return "miss";
  return "ok";
}

// This fallback is generated from A12345_W01_RawResult.csv by the backend script.
// It is deliberately limited to the exact source wafer; no synthetic wafer data
// is fabricated when the backend is unavailable.
export function getCsvWaferThermal(lot: string, wafer: string): WaferThermal | undefined {
  if (lot !== LIVE_LOT || wafer !== "W01") return undefined;

  const stageOf = (position: number): SensorStage =>
    position < COMPLETED_SENSORS ? "verified" : position === COMPLETED_SENSORS ? "next" : "future";

  return {
    lot,
    wafer,
    isLive: true,
    generatedAt: new Date().toISOString(),
    completedSensors: COMPLETED_SENSORS,
    nextSensor: thermalFixture.sensors[COMPLETED_SENSORS]?.index ?? null,
    sensors: thermalFixture.sensors.map((sensor, position) => ({
      ...sensor,
      warnThreshold: sensor.upperLimit - thermalFixture.warnMargin,
      stage: stageOf(position),
    })),
    devices: thermalFixture.devices.map((device) => ({
      pid: device.pid,
      site: device.site,
      x: device.x,
      y: device.y,
      sensors: device.sensors.map((sensorValue, position) => {
        const stage = stageOf(position);
        const upper = thermalFixture.sensors[position].upperLimit;
        const predicted = stage === "future" ? null : sensorValue.predicted;
        const actual = stage === "verified" ? sensorValue.actual : null;
        const status = stage === "future" ? "pending" : classify(predicted, upper);
        return {
          sensor: thermalFixture.sensors[position].index,
          predicted,
          actual,
          error: predicted !== null && actual !== null ? actual - predicted : null,
          status,
          verdict: verdict(status, actual, upper),
        };
      }),
    })),
  };
}
