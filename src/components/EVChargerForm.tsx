import type { EVChargerInfo, MainPanel } from '../types';
import { calcKw } from '../types';

interface Props {
  data: EVChargerInfo;
  index: number;
  panels: MainPanel[];
  serviceVoltage: string;
  canRemove: boolean;
  onChange: (data: EVChargerInfo) => void;
  onRemove: () => void;
}

function chargerVoltage(level: string, serviceVoltage: string): number {
  if (level === 'Level 1') return 120;
  // Level 2 voltage depends on service
  switch (serviceVoltage) {
    case '120/208V': return 208;
    case '277/480V': return 480;
    case '120/240V':
    default: return 240;
  }
}

export function EVChargerForm({ data, index, panels, serviceVoltage, canRemove, onChange, onRemove }: Props) {
  const update = (field: keyof EVChargerInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const voltage = chargerVoltage(data.chargerLevel, serviceVoltage);
  const kw = calcKw(String(voltage), data.chargerAmps);

  return (
    <fieldset className="multi-item">
      <legend>
        {data.chargerLabel || `EV Charger ${index + 1}`}
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
            placeholder="e.g. EV Charger 1, Garage EVSE"
          />
        </label>
        <label>
          Connected Panel
          <select
            value={data.panelId}
            onChange={(e) => update('panelId', e.target.value)}
          >
            <option value="">Select...</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.panelName || `Panel ${p.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Charger Level
          <select
            value={data.chargerLevel}
            onChange={(e) => update('chargerLevel', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="Level 1">Level 1 (120V)</option>
            <option value="Level 2">Level 2 ({serviceVoltage === '120/208V' ? '208V' : '240V'})</option>
          </select>
        </label>
        <label>
          Charger Amps
          <select
            value={data.chargerAmps}
            onChange={(e) => update('chargerAmps', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="16">16A</option>
            <option value="24">24A</option>
            <option value="32">32A</option>
            <option value="40">40A</option>
            <option value="48">48A</option>
            <option value="50">50A</option>
            <option value="60">60A</option>
            <option value="80">80A</option>
          </select>
        </label>
        <label>
          Breaker Size
          <select
            value={data.breakerSize}
            onChange={(e) => update('breakerSize', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="20">20A</option>
            <option value="30">30A</option>
            <option value="40">40A</option>
            <option value="50">50A</option>
            <option value="60">60A</option>
            <option value="70">70A</option>
            <option value="80">80A</option>
            <option value="100">100A</option>
          </select>
        </label>
        <label>
          kW Output
          <input
            type="text"
            value={kw > 0 ? `${kw.toFixed(1)} kW (${voltage}V x ${data.chargerAmps}A)` : '--'}
            readOnly
            className="computed-field"
          />
        </label>
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
            <option value="12 AWG">12 AWG</option>
            <option value="10 AWG">10 AWG</option>
            <option value="8 AWG">8 AWG</option>
            <option value="6 AWG">6 AWG</option>
            <option value="4 AWG">4 AWG</option>
            <option value="3 AWG">3 AWG</option>
            <option value="2 AWG">2 AWG</option>
            <option value="1 AWG">1 AWG</option>
            <option value="1/0 AWG">1/0 AWG</option>
            <option value="2/0 AWG">2/0 AWG</option>
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
            <option value="PVC">PVC</option>
            <option value="Flex">Flexible Conduit</option>
            <option value="MC Cable">MC Cable</option>
            <option value="NM-B">NM-B (Romex)</option>
            <option value="Direct Burial">Direct Burial</option>
          </select>
        </label>
        <label className="full-width">
          Install Location
          <input
            type="text"
            value={data.installLocation}
            onChange={(e) => update('installLocation', e.target.value)}
            placeholder="e.g. Left wall of garage, 4ft from floor"
          />
        </label>
      </div>
    </fieldset>
  );
}
