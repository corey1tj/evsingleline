import type { Panel, ElectricalService } from '../types';
import { availableBusVoltages } from '../types';

interface Props {
  data: Panel;
  isMdp: boolean;
  canRemove: boolean;
  allPanels: Panel[];
  services: ElectricalService[];
  onChange: (data: Panel) => void;
  onRemove: () => void;
}

export function MainPanelForm({ data, isMdp, canRemove, allPanels, services, onChange, onRemove }: Props) {
  const update = (field: keyof Panel, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Get parent panel's bus voltage for sub-panel bus voltage options
  const parentPanel = data.parentId ? allPanels.find((p) => p.id === data.parentId) : null;
  const parentBusVoltage = parentPanel?.busVoltage || '';
  const busVoltageOptions = isMdp ? [] : availableBusVoltages(parentBusVoltage);

  const service = services.find((s) => s.id === data.serviceId);

  return (
    <fieldset className={`multi-item ${isMdp ? 'mdp-item' : 'sub-panel-item'}`}>
      <legend>
        {isMdp ? 'MDP' : ''} {data.panelName || (isMdp ? 'Main Distribution Panel' : 'Sub-Panel')}
        {data.busVoltage && <span className="voltage-badge">{data.busVoltage}V</span>}
        {canRemove && (
          <button type="button" className="btn-remove legend-remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </legend>
      <div className="form-grid">
        <label>
          Panel Name
          <input
            type="text"
            value={data.panelName}
            onChange={(e) => update('panelName', e.target.value)}
            placeholder={isMdp ? 'e.g. Main Distribution Panel' : 'e.g. DCFC Panel, Garage Sub'}
          />
        </label>
        <label>
          Panel Location
          <input
            type="text"
            value={data.panelLocation}
            onChange={(e) => update('panelLocation', e.target.value)}
            placeholder="e.g. Electrical Room, Garage"
          />
        </label>
        {!isMdp && (
          <label>
            Feed Breaker (from {parentPanel?.panelName || 'parent'})
            <select
              value={data.feedBreakerAmps}
              onChange={(e) => update('feedBreakerAmps', e.target.value)}
            >
              <option value="">Select...</option>
              {[30, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 800].map((a) => (
                <option key={a} value={String(a)}>{a}A</option>
              ))}
            </select>
          </label>
        )}
        {!isMdp && busVoltageOptions.length > 1 && (
          <label>
            Bus Voltage
            <select
              value={data.busVoltage}
              onChange={(e) => update('busVoltage', e.target.value)}
            >
              {busVoltageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        {isMdp && service && (
          <label>
            Bus Voltage
            <input type="text" value={data.busVoltage ? `${data.busVoltage}V` : '(set service voltage)'} readOnly className="readonly-field" />
          </label>
        )}
        <label>
          Panel Make
          <input
            type="text"
            value={data.panelMake}
            onChange={(e) => update('panelMake', e.target.value)}
            placeholder="e.g. Square D, Siemens, Eaton"
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
            {[60, 100, 125, 150, 200, 225, 300, 400, 600, 800, 1000, 1200, 1600, 2000].map((a) => (
              <option key={a} value={String(a)}>{a}A</option>
            ))}
          </select>
        </label>
        <label>
          Bus Rating (Amps)
          <select
            value={data.busRatingAmps}
            onChange={(e) => update('busRatingAmps', e.target.value)}
          >
            <option value="">Select...</option>
            {[100, 125, 150, 200, 225, 300, 400, 600, 800, 1000, 1200, 1600, 2000].map((a) => (
              <option key={a} value={String(a)}>{a}A</option>
            ))}
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
