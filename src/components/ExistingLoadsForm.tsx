import type { ExistingLoad } from '../types';

interface Props {
  loads: ExistingLoad[];
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

export function ExistingLoadsForm({ loads, onChange }: Props) {
  const addLoad = () => {
    onChange([
      ...loads,
      { id: String(nextId++), name: '', breakerAmps: '', voltage: '240' },
    ]);
  };

  const removeLoad = (id: string) => {
    onChange(loads.filter((l) => l.id !== id));
  };

  const updateLoad = (id: string, field: keyof ExistingLoad, value: string) => {
    onChange(loads.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const totalAmps = loads.reduce((sum, l) => sum + (Number(l.breakerAmps) || 0), 0);

  return (
    <fieldset>
      <legend>Existing Loads</legend>
      {loads.length > 0 && (
        <table className="loads-table">
          <thead>
            <tr>
              <th>Load Name</th>
              <th>Breaker (A)</th>
              <th>Voltage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load) => (
              <tr key={load.id}>
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
                  {!COMMON_LOADS.includes(load.name) && load.name !== '' ? null : null}
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
                    <option value="120">120V</option>
                    <option value="240">240V</option>
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
            ))}
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
