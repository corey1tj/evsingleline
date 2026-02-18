import type { MainPanel, Breaker } from '../types';
import { breakerSpaces, totalSpacesUsed, voltageOptionsForService } from '../types';

interface Props {
  panel: MainPanel;
  index: number;
  allPanels: MainPanel[];
  serviceVoltage: string;
  canRemove: boolean;
  onUpdatePanel: (id: string, updated: MainPanel) => void;
  onRemovePanel: (id: string) => void;
  onAddBreaker: (panelId: string) => void;
  onUpdateBreaker: (panelId: string, breakerId: string, updated: Breaker) => void;
  onRemoveBreaker: (panelId: string, breakerId: string) => void;
  onAddSubPanel: (parentPanelId: string) => void;
  depth: number;
}

const COMMON_LOADS = [
  'HVAC / Heat Pump',
  'Air Conditioner',
  'Electric Range / Oven',
  'Electric Dryer',
  'Water Heater',
  'Pool / Spa Pump',
  'Well Pump',
  'Electric Furnace',
  'Lighting',
  'Receptacles',
  'Dishwasher',
  'Garbage Disposal',
  'Microwave',
  'Washer',
  'Garage Door Opener',
  'Other',
];

export function PanelHierarchy({
  panel,
  index,
  allPanels,
  serviceVoltage,
  canRemove,
  onUpdatePanel,
  onRemovePanel,
  onAddBreaker,
  onUpdateBreaker,
  onRemoveBreaker,
  onAddSubPanel,
  depth,
}: Props) {
  const updateField = (field: keyof MainPanel, value: string) => {
    onUpdatePanel(panel.id, { ...panel, [field]: value });
  };

  const childPanels = allPanels.filter((p) => p.parentPanelId === panel.id);

  const spacesUsed = totalSpacesUsed(panel.breakers);
  const totalSp = Number(panel.totalSpaces) || 0;
  const availableSpaces = totalSp - spacesUsed;

  const voltageOptions = voltageOptionsForService(serviceVoltage);

  const totalBreakerAmps = panel.breakers
    .filter((b) => b.type === 'load')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);

  const depthClass = depth > 0 ? 'panel-nested' : '';

  return (
    <div className={`panel-hierarchy ${depthClass}`}>
      <fieldset className={depth === 0 ? 'multi-item' : 'multi-item sub-panel-fieldset'}>
        <legend>
          {panel.panelName || `Panel ${index + 1}`}
          {panel.parentPanelId && <span className="panel-badge">Sub Panel</span>}
          {!panel.parentPanelId && depth === 0 && <span className="panel-badge panel-badge-mdp">MDP</span>}
          {canRemove && (
            <button type="button" className="btn-remove legend-remove" onClick={() => onRemovePanel(panel.id)}>
              Remove
            </button>
          )}
        </legend>

        {/* Panel info fields */}
        <div className="form-grid">
          <label>
            Panel Name
            <input
              type="text"
              value={panel.panelName}
              onChange={(e) => updateField('panelName', e.target.value)}
              placeholder={panel.parentPanelId ? 'e.g. Sub Panel A' : 'e.g. MDP, Main Panel'}
            />
          </label>
          <label>
            Panel Location
            <input
              type="text"
              value={panel.panelLocation}
              onChange={(e) => updateField('panelLocation', e.target.value)}
              placeholder="e.g. Garage, Basement"
            />
          </label>
          <label>
            Panel Make
            <input
              type="text"
              value={panel.panelMake}
              onChange={(e) => updateField('panelMake', e.target.value)}
              placeholder="e.g. Square D, Siemens"
            />
          </label>
          <label>
            Panel Model
            <input
              type="text"
              value={panel.panelModel}
              onChange={(e) => updateField('panelModel', e.target.value)}
            />
          </label>
          <label>
            Main Breaker (Amps)
            <select
              value={panel.mainBreakerAmps}
              onChange={(e) => updateField('mainBreakerAmps', e.target.value)}
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
              value={panel.busRatingAmps}
              onChange={(e) => updateField('busRatingAmps', e.target.value)}
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
              value={panel.totalSpaces}
              onChange={(e) => updateField('totalSpaces', e.target.value)}
              min="0"
            />
          </label>
          <label>
            Spaces Used / Available
            <input
              type="text"
              value={totalSp > 0 ? `${spacesUsed} used / ${availableSpaces} available` : '--'}
              readOnly
              className="computed-field"
            />
          </label>
        </div>

        {/* Breakers table */}
        <div className="breakers-section">
          <div className="breakers-header">
            <h4>Breakers</h4>
            <span className="breaker-summary">
              {totalBreakerAmps > 0 && `${totalBreakerAmps}A total load`}
              {totalSp > 0 && ` | ${spacesUsed}/${totalSp} spaces`}
            </span>
          </div>

          {panel.breakers.length > 0 && (
            <table className="breakers-table">
              <thead>
                <tr>
                  <th>Ckt #</th>
                  <th>Label</th>
                  <th>Amps</th>
                  <th>Voltage</th>
                  <th>Spaces</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panel.breakers.map((breaker) => (
                  <BreakerRow
                    key={breaker.id}
                    breaker={breaker}
                    panelId={panel.id}
                    voltageOptions={voltageOptions}
                    onUpdate={onUpdateBreaker}
                    onRemove={onRemoveBreaker}
                  />
                ))}
              </tbody>
            </table>
          )}

          <div className="breakers-footer">
            <button type="button" className="btn-add btn-small" onClick={() => onAddBreaker(panel.id)}>
              + Add Breaker
            </button>
            <button type="button" className="btn-add btn-small btn-subpanel" onClick={() => onAddSubPanel(panel.id)}>
              + Add Sub Panel
            </button>
          </div>

          {totalSp > 0 && availableSpaces < 0 && (
            <div className="calc-alert warning" style={{ marginTop: '0.5rem' }}>
              Panel exceeds available spaces by {Math.abs(availableSpaces)}.
            </div>
          )}
        </div>
      </fieldset>

      {/* Recursively render child sub-panels */}
      {childPanels.map((child, childIdx) => (
        <PanelHierarchy
          key={child.id}
          panel={child}
          index={childIdx}
          allPanels={allPanels}
          serviceVoltage={serviceVoltage}
          canRemove={true}
          onUpdatePanel={onUpdatePanel}
          onRemovePanel={onRemovePanel}
          onAddBreaker={onAddBreaker}
          onUpdateBreaker={onUpdateBreaker}
          onRemoveBreaker={onRemoveBreaker}
          onAddSubPanel={onAddSubPanel}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// Individual breaker row component
function BreakerRow({
  breaker,
  panelId,
  voltageOptions,
  onUpdate,
  onRemove,
}: {
  breaker: Breaker;
  panelId: string;
  voltageOptions: { value: string; label: string }[];
  onUpdate: (panelId: string, breakerId: string, updated: Breaker) => void;
  onRemove: (panelId: string, breakerId: string) => void;
}) {
  const update = (field: keyof Breaker, value: string) => {
    onUpdate(panelId, breaker.id, { ...breaker, [field]: value });
  };

  const spaces = breakerSpaces(breaker.voltage);
  const isSubPanel = breaker.type === 'subpanel';

  return (
    <tr className={isSubPanel ? 'breaker-row-subpanel' : ''}>
      <td>
        <input
          type="text"
          value={breaker.circuitNumber}
          onChange={(e) => update('circuitNumber', e.target.value)}
          className="ckt-input"
          placeholder="#"
        />
      </td>
      <td>
        {isSubPanel ? (
          <span className="subpanel-label">{breaker.label || 'Sub Panel'}</span>
        ) : (
          <select
            value={COMMON_LOADS.includes(breaker.label) ? breaker.label : (breaker.label ? 'Other' : '')}
            onChange={(e) => {
              const val = e.target.value;
              update('label', val === 'Other' ? '' : val);
            }}
          >
            <option value="">Select...</option>
            {COMMON_LOADS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        {!isSubPanel && !COMMON_LOADS.includes(breaker.label) && breaker.label !== '' && (
          <input
            type="text"
            placeholder="Describe..."
            value={breaker.label}
            onChange={(e) => update('label', e.target.value)}
            style={{ marginTop: '0.2rem', width: '100%' }}
          />
        )}
        {!isSubPanel && breaker.label === '' && (
          <input
            type="text"
            placeholder="Describe..."
            value=""
            onChange={(e) => update('label', e.target.value)}
            style={{ marginTop: '0.2rem', width: '100%' }}
          />
        )}
      </td>
      <td>
        <input
          type="number"
          value={breaker.amps}
          onChange={(e) => update('amps', e.target.value)}
          min="0"
          className="amps-input"
          placeholder="A"
        />
      </td>
      <td>
        <select
          value={breaker.voltage}
          onChange={(e) => update('voltage', e.target.value)}
        >
          {voltageOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
      <td className="spaces-cell">
        {spaces}
      </td>
      <td>
        {isSubPanel ? (
          <span className="type-badge type-subpanel">Sub Panel</span>
        ) : (
          <span className="type-badge type-load">Load</span>
        )}
      </td>
      <td>
        <button type="button" className="btn-remove btn-remove-sm" onClick={() => onRemove(panelId, breaker.id)}>
          &times;
        </button>
      </td>
    </tr>
  );
}
