import type { ExistingLoad, Panel } from '../types';
import { loadVoltagesForBus } from '../types';

interface Props {
  loads: ExistingLoad[];
  panels: Panel[];
  onChange: (loads: ExistingLoad[]) => void;
}

const COMMON_LOADS = [
  'HVAC / Heat Pump',
  'Air Conditioner',
  'Electric Range / Oven',
  'Electric Dryer',
  'Water Heater',
  'Pool / Spa Pump',
  'Sub Panel',
  'Well Pump',
  'Electric Furnace',
  'Other',
];

let nextId = 1;

export function ExistingLoadsForm({ loads, panels, onChange }: Props) {
  const defaultPanelId = panels.length > 0 ? panels[0].id : '';

  const addLoad = () => {
    onChange([
      ...loads,
      { id: String(nextId++), panelId: defaultPanelId, name: '', breakerAmps: '', voltage: '240' },
    ]);
  };

  const removeLoad = (id: string) => {
    onChange(loads.filter((l) => l.id !== id));
  };

  const updateLoad = (id: string, field: keyof ExistingLoad, value: string) => {
    onChange(loads.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const totalAmps = loads.reduce((sum, l) => sum + (Number(l.breakerAmps) || 0), 0);

  const getPanel = (panelId: string) => panels.find((p) => p.id === panelId);

  return (
    <fieldset>
      <legend>Existing Loads</legend>
      {loads.length > 0 && (
        <table className="loads-table">
          <thead>
            <tr>
              {panels.length > 1 && <th>Panel</th>}
              <th>Load Name</th>
              <th>Breaker (A)</th>
              <th>Voltage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load) => {
              const panel = getPanel(load.panelId);
              const voltageOpts = panel ? loadVoltagesForBus(panel.busVoltage) : ['120', '240'];
              return (
                <tr key={load.id}>
                  {panels.length > 1 && (
                    <td>
                      <select
                        value={load.panelId}
                        onChange={(e) => updateLoad(load.id, 'panelId', e.target.value)}
                      >
                        {panels.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.panelName || `Panel ${p.id}`} ({p.busVoltage || '?'}V)
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>
                    <select
                      value={COMMON_LOADS.includes(load.name) ? load.name : 'Other'}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLoad(load.id, 'name', val === 'Other' ? '' : val);
                      }}
                    >
                      <option value="">Select...</option>
                      {COMMON_LOADS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const isOther =
                        !COMMON_LOADS.includes(load.name) ||
                        load.name === 'Other' ||
                        load.name === '';
                      return isOther ? (
                        <input
                          type="text"
                          placeholder="Describe load..."
                          value={load.name === 'Other' ? '' : load.name}
                          onChange={(e) => updateLoad(load.id, 'name', e.target.value)}
                          style={{ marginTop: '0.25rem' }}
                        />
                      ) : null;
                    })()}
                  </td>
                  <td>
                    <input
                      type="number"
                      value={load.breakerAmps}
                      onChange={(e) => updateLoad(load.id, 'breakerAmps', e.target.value)}
                      min="0"
                      style={{ width: '80px' }}
                    />
                  </td>
                  <td>
                    <select
                      value={load.voltage}
                      onChange={(e) => updateLoad(load.id, 'voltage', e.target.value)}
                    >
                      {voltageOpts.map((v) => (
                        <option key={v} value={v}>{v}V</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeLoad(load.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="loads-footer">
        <button type="button" className="btn-add" onClick={addLoad}>
          + Add Load
        </button>
        {loads.length > 0 && (
          <span className="loads-total">
            Total breaker amps: <strong>{totalAmps}A</strong>
          </span>
        )}
      </div>
    </fieldset>
  );
}
