import type { EVChargerInfo } from '../types';
import {
  chargerLevelsForBus,
  chargerVoltageForLevel,
  minBreakerForContinuousLoad,
  STANDARD_BREAKER_SIZES,
} from '../types';

interface Props {
  data: EVChargerInfo;
  index: number;
  panelBusVoltage: string;
  canRemove: boolean;
  onChange: (data: EVChargerInfo) => void;
  onRemove: () => void;
}

// Charger amperage options by level
function chargerAmpOptions(level: string): number[] {
  if (level === 'Level 1') return [12, 16];
  if (level === 'Level 2') return [16, 24, 32, 40, 48, 50, 60, 80];
  if (level === 'Level 3 DCFC') return [60, 75, 100, 125, 150, 180, 200, 250, 300, 350, 400];
  return [];
}

// Wire size options by level
function wireSizeOptions(level: string): string[] {
  if (level === 'Level 3 DCFC') {
    return [
      '6 AWG', '4 AWG', '3 AWG', '2 AWG', '1 AWG',
      '1/0 AWG', '2/0 AWG', '3/0 AWG', '4/0 AWG',
      '250 MCM', '300 MCM', '350 MCM', '400 MCM', '500 MCM',
      '600 MCM', '750 MCM',
    ];
  }
  return [
    '12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG',
    '3 AWG', '2 AWG', '1 AWG', '1/0 AWG', '2/0 AWG',
    '3/0 AWG', '4/0 AWG',
  ];
}

export function EVChargerForm({ data, index, panelBusVoltage, canRemove, onChange, onRemove }: Props) {
  const update = (field: keyof EVChargerInfo, value: string) => {
    const next = { ...data, [field]: value };

    // Auto-set voltage when level changes
    if (field === 'chargerLevel') {
      next.chargerVoltage = chargerVoltageForLevel(value, panelBusVoltage);
      // Reset amps and breaker if level changed
      next.chargerAmps = '';
      next.breakerSize = '';
    }

    // Auto-suggest breaker when charger amps changes (80% rule)
    if (field === 'chargerAmps' && value) {
      const amps = Number(value);
      if (amps > 0) {
        const minBreaker = minBreakerForContinuousLoad(amps);
        // Only auto-set if current breaker is too small or empty
        const currentBreaker = Number(next.breakerSize) || 0;
        if (currentBreaker < minBreaker) {
          next.breakerSize = String(minBreaker);
        }
      }
    }

    onChange(next);
  };

  const levelOptions = chargerLevelsForBus(panelBusVoltage);
  const ampOptions = chargerAmpOptions(data.chargerLevel);
  const amps = Number(data.chargerAmps) || 0;
  const minBreaker = amps > 0 ? minBreakerForContinuousLoad(amps) : 0;
  const currentBreaker = Number(data.breakerSize) || 0;
  const breakerTooSmall = amps > 0 && currentBreaker > 0 && currentBreaker < minBreaker;

  // Compute kW for display
  const voltage = Number(data.chargerVoltage) || 0;
  const isThreePhase = data.chargerLevel === 'Level 3 DCFC';
  const kw = voltage > 0 && amps > 0
    ? isThreePhase
      ? (voltage * amps * 1.732) / 1000
      : (voltage * amps) / 1000
    : 0;

  return (
    <fieldset className={`multi-item charger-item ${data.chargerLevel === 'Level 3 DCFC' ? 'dcfc' : ''}`}>
      <legend>
        {data.chargerLabel || `EV Charger ${index + 1}`}
        {data.chargerVoltage && <span className="voltage-badge">{data.chargerVoltage}V</span>}
        {kw > 0 && <span className="kw-badge">{kw.toFixed(1)} kW</span>}
        {canRemove && (
          <button type="button" className="btn-remove legend-remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </legend>
      <div className="form-grid">
        <label>
          Charger Label
          <input
            type="text"
            value={data.chargerLabel}
            onChange={(e) => update('chargerLabel', e.target.value)}
            placeholder="e.g. EV Charger 1, DCFC Station A"
          />
        </label>
        <label>
          Charger Level
          <select
            value={data.chargerLevel}
            onChange={(e) => update('chargerLevel', e.target.value)}
          >
            <option value="">Select...</option>
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          Charger Voltage
          <input
            type="text"
            value={data.chargerVoltage ? `${data.chargerVoltage}V${isThreePhase ? ' 3\u03A6' : ''}` : '(select level)'}
            readOnly
            className="readonly-field"
          />
        </label>
        <label>
          Charger Amps (continuous)
          <select
            value={data.chargerAmps}
            onChange={(e) => update('chargerAmps', e.target.value)}
          >
            <option value="">Select...</option>
            {ampOptions.map((a) => (
              <option key={a} value={String(a)}>{a}A</option>
            ))}
          </select>
        </label>
        <label>
          Breaker Size
          {amps > 0 && (
            <span className="field-hint">
              Min {minBreaker}A (80% rule: {amps}A &times; 1.25)
            </span>
          )}
          <select
            value={data.breakerSize}
            onChange={(e) => update('breakerSize', e.target.value)}
            className={breakerTooSmall ? 'input-warning' : ''}
          >
            <option value="">Select...</option>
            {STANDARD_BREAKER_SIZES.filter((s) => s >= minBreaker || minBreaker === 0).map((s) => (
              <option key={s} value={String(s)}>{s}A{s === minBreaker ? ' (minimum)' : ''}</option>
            ))}
          </select>
        </label>
        {breakerTooSmall && (
          <div className="field-error full-width">
            Breaker {currentBreaker}A is below the NEC 80% continuous load minimum of {minBreaker}A for a {amps}A charger.
          </div>
        )}
        <label>
          Wire Run (feet)
          <input
            type="number"
            value={data.wireRunFeet}
            onChange={(e) => update('wireRunFeet', e.target.value)}
            min="0"
          />
        </label>
        <label>
          Wire Size
          <select
            value={data.wireSize}
            onChange={(e) => update('wireSize', e.target.value)}
          >
            <option value="">Select...</option>
            {wireSizeOptions(data.chargerLevel).map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
        <label>
          Conduit Type
          <select
            value={data.conduitType}
            onChange={(e) => update('conduitType', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="EMT">EMT</option>
            <option value="RMC">RMC (Rigid Metal)</option>
            <option value="IMC">IMC</option>
            <option value="PVC">PVC</option>
            <option value="Flex">Flexible Conduit</option>
            <option value="MC Cable">MC Cable</option>
            {data.chargerLevel !== 'Level 3 DCFC' && <option value="NM-B">NM-B (Romex)</option>}
            <option value="Direct Burial">Direct Burial</option>
          </select>
        </label>
        <label className="full-width">
          Install Location
          <input
            type="text"
            value={data.installLocation}
            onChange={(e) => update('installLocation', e.target.value)}
            placeholder={data.chargerLevel === 'Level 3 DCFC'
              ? 'e.g. Parking lot island #3, pad-mounted'
              : 'e.g. Left wall of garage, 4ft from floor'}
          />
        </label>
      </div>
    </fieldset>
  );
}
