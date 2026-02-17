import type { MainPanel } from '../types';

interface Props {
  data: MainPanel;
  onChange: (data: MainPanel) => void;
}

export function MainPanelForm({ data, onChange }: Props) {
  const update = (field: keyof MainPanel, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <fieldset>
      <legend>Main Panel</legend>
      <div className="form-grid">
        <label>
          Panel Location
          <input
            type="text"
            value={data.panelLocation}
            onChange={(e) => update('panelLocation', e.target.value)}
            placeholder="e.g. Garage, Basement"
          />
        </label>
        <label>
          Panel Make
          <input
            type="text"
            value={data.panelMake}
            onChange={(e) => update('panelMake', e.target.value)}
            placeholder="e.g. Square D, Siemens"
          />
        </label>
        <label>
          Panel Model
          <input
            type="text"
            value={data.panelModel}
            onChange={(e) => update('panelModel', e.target.value)}
          />
        </label>
        <label>
          Main Breaker (Amps)
          <select
            value={data.mainBreakerAmps}
            onChange={(e) => update('mainBreakerAmps', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="100">100A</option>
            <option value="125">125A</option>
            <option value="150">150A</option>
            <option value="200">200A</option>
            <option value="225">225A</option>
            <option value="300">300A</option>
            <option value="400">400A</option>
          </select>
        </label>
        <label>
          Bus Rating (Amps)
          <select
            value={data.busRatingAmps}
            onChange={(e) => update('busRatingAmps', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="100">100A</option>
            <option value="125">125A</option>
            <option value="150">150A</option>
            <option value="200">200A</option>
            <option value="225">225A</option>
            <option value="300">300A</option>
            <option value="400">400A</option>
          </select>
        </label>
        <label>
          Total Spaces
          <input
            type="number"
            value={data.totalSpaces}
            onChange={(e) => update('totalSpaces', e.target.value)}
            min="0"
          />
        </label>
        <label>
          Available Spaces
          <input
            type="number"
            value={data.availableSpaces}
            onChange={(e) => update('availableSpaces', e.target.value)}
            min="0"
          />
        </label>
      </div>
    </fieldset>
  );
}
