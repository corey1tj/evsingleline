import type { MainPanel, Breaker } from '../types';
import {
  breakerSpaces, totalSpacesUsed, voltageOptionsForService, calcKw,
  chargerVoltage, STANDARD_BREAKER_SIZES, STANDARD_KVA_SIZES,
  getEffectivePanelVoltage, stepDownOptions, transformerFLA,
  minBreakerAmpsForEv, nextBreakerSize, breakerKva, evChargerKw,
} from '../types';

interface Props {
  panel: MainPanel;
  index: number;
  allPanels: MainPanel[];
  serviceVoltage: string;
  canRemove: boolean;
  onUpdatePanel: (id: string, updated: MainPanel) => void;
  onRemovePanel: (id: string) => void;
  onAddBreaker: (panelId: string) => void;
  onAddEvCharger: (panelId: string) => void;
  onUpdateBreaker: (panelId: string, breakerId: string, updated: Breaker) => void;
  onRemoveBreaker: (panelId: string, breakerId: string) => void;
  onAddSubPanel: (parentPanelId: string) => void;
  depth: number;
}

const LOAD_CATEGORIES: { category: string; loads: string[] }[] = [
  {
    category: 'HVAC / Mechanical',
    loads: [
      'HVAC / Heat Pump',
      'Air Conditioner',
      'RTU (Rooftop Unit)',
      'AHU (Air Handler)',
      'Chiller',
      'Boiler',
      'Compressor',
      'Electric Furnace',
      'Exhaust Fan',
      'Supply Fan',
      'VAV Box',
      'Unit Heater',
      'Make-Up Air Unit',
    ],
  },
  {
    category: 'Lighting',
    loads: [
      'Lighting',
      'Emergency Lighting',
      'Exterior Lighting',
      'Parking Lot Lighting',
      'Sign / Signage',
    ],
  },
  {
    category: 'Power / Receptacles',
    loads: [
      'Receptacles',
      'Motor',
      'Welding Outlet',
      'UPS',
      'Server / IT Equipment',
      'Elevator',
      'Escalator',
      'Conveyor',
      'Garage Door Opener',
    ],
  },
  {
    category: 'Kitchen / Food Service',
    loads: [
      'Electric Range / Oven',
      'Commercial Oven',
      'Walk-in Cooler',
      'Walk-in Freezer',
      'Ice Machine',
      'Dishwasher',
      'Garbage Disposal',
      'Microwave',
      'Hood Exhaust Fan',
    ],
  },
  {
    category: 'Plumbing / Fire',
    loads: [
      'Water Heater',
      'Booster Pump',
      'Sump Pump',
      'Well Pump',
      'Pool / Spa Pump',
      'Fire Pump',
      'Jockey Pump',
    ],
  },
  {
    category: 'Life Safety / Controls',
    loads: [
      'Fire Alarm Panel',
      'Security System',
      'BMS / Building Automation',
      'Access Control',
      'Smoke Detection',
      'PA / Intercom',
    ],
  },
  {
    category: 'Residential',
    loads: [
      'Electric Dryer',
      'Washer',
    ],
  },
];

// Flat list of all load names (for validation checks)
const COMMON_LOADS = LOAD_CATEGORIES.flatMap((c) => c.loads).concat(['Other']);

const COMMON_PANEL_AMPS = ['100', '125', '150', '200', '225', '300', '400', '600', '800', '1000', '1200'];

function AmpsSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const isCustom = value !== '' && !COMMON_PANEL_AMPS.includes(value);
  return (
    <label>
      {label}
      <select
        value={isCustom ? '__custom__' : value}
        onChange={(e) => {
          if (e.target.value === '__custom__') {
            onChange(value || '');
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Select...</option>
        {COMMON_PANEL_AMPS.map((a) => (
          <option key={a} value={a}>{a}A</option>
        ))}
        <option value="__custom__">Custom...</option>
      </select>
      {isCustom && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter amps"
          min="0"
          style={{ marginTop: '0.25rem' }}
        />
      )}
    </label>
  );
}

export function PanelHierarchy({
  panel,
  index,
  allPanels,
  serviceVoltage,
  canRemove,
  onUpdatePanel,
  onRemovePanel,
  onAddBreaker,
  onAddEvCharger,
  onUpdateBreaker,
  onRemoveBreaker,
  onAddSubPanel,
  depth,
}: Props) {
  const updateField = (field: keyof MainPanel, value: string) => {
    onUpdatePanel(panel.id, { ...panel, [field]: value });
  };

  // Effective voltage for this panel (may differ from service voltage if transformer)
  const effectiveVoltage = getEffectivePanelVoltage(panel, allPanels, serviceVoltage);

  // Parent panel's effective voltage (for transformer step-down options)
  const parentPanel = panel.parentPanelId
    ? allPanels.find((p) => p.id === panel.parentPanelId)
    : undefined;
  const parentVoltage = parentPanel
    ? getEffectivePanelVoltage(parentPanel, allPanels, serviceVoltage)
    : serviceVoltage;
  const stepDownOpts = panel.parentPanelId ? stepDownOptions(parentVoltage) : [];

  const childPanels = allPanels.filter((p) => p.parentPanelId === panel.id);

  const spacesUsed = totalSpacesUsed(panel.breakers);
  const spareCount = Number(panel.spareSpaces) || 0;
  const totalSp = Number(panel.totalSpaces) || 0;
  const accountedSpaces = spacesUsed + spareCount;
  const availableSpaces = totalSp - accountedSpaces;

  const voltageOptions = voltageOptionsForService(effectiveVoltage);

  const totalBreakerAmps = panel.breakers
    .filter((b) => b.type === 'load' || b.type === 'evcharger')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);

  const totalPanelKw = panel.breakers.reduce((sum, b) => {
    if (b.type === 'subpanel') return sum;
    if (b.type === 'evcharger') return sum + evChargerKw(b);
    return sum + breakerKva(b);
  }, 0);

  const depthClass = depth > 0 ? 'panel-nested' : '';

  // Transformer math
  const hasTransformer = !!panel.transformer;
  const xfKva = Number(panel.transformer?.kva) || 0;
  const xfPrimaryFLA = hasTransformer ? transformerFLA(xfKva, panel.transformer!.primaryVoltage) : 0;
  const xfSecondaryFLA = hasTransformer ? transformerFLA(xfKva, panel.transformer!.secondaryVoltage) : 0;

  const handleVoltageSystemChange = (value: string) => {
    if (value === '' || value === parentVoltage) {
      // Same as parent - remove transformer
      onUpdatePanel(panel.id, {
        ...panel,
        transformer: undefined,
        panelVoltage: undefined,
      });
    } else {
      // Step down via transformer
      onUpdatePanel(panel.id, {
        ...panel,
        transformer: {
          kva: panel.transformer?.kva || '',
          primaryVoltage: parentVoltage,
          secondaryVoltage: value,
        },
        panelVoltage: value,
      });
    }
  };

  const handleTransformerKva = (kva: string) => {
    if (!panel.transformer) return;
    onUpdatePanel(panel.id, {
      ...panel,
      transformer: { ...panel.transformer, kva },
    });
  };

  return (
    <div className={`panel-hierarchy ${depthClass}`}>
      <fieldset className={depth === 0 ? 'multi-item' : 'multi-item sub-panel-fieldset'}>
        <legend>
          {panel.panelName || `Panel ${index + 1}`}
          {panel.parentPanelId && <span className="panel-badge">Sub Panel</span>}
          {!panel.parentPanelId && depth === 0 && <span className="panel-badge panel-badge-mdp">MDP</span>}
          {hasTransformer && (
            <span className="panel-badge panel-badge-xfmr">XFMR {effectiveVoltage}</span>
          )}
          {panel.condition === 'new' && <span className="condition-badge condition-new">NEW</span>}
          {canRemove && (
            <button type="button" className="btn-remove legend-remove" onClick={() => onRemovePanel(panel.id)}>
              Remove
            </button>
          )}
        </legend>

        {/* Transformer voltage selector for sub-panels */}
        {panel.parentPanelId && stepDownOpts.length > 0 && (
          <div className="transformer-section">
            <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
              <label>
                Panel Voltage
                <select
                  value={panel.transformer?.secondaryVoltage || ''}
                  onChange={(e) => handleVoltageSystemChange(e.target.value)}
                >
                  <option value="">Same as parent ({parentVoltage})</option>
                  {stepDownOpts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {hasTransformer && (
                <>
                  <label>
                    Transformer kVA
                    <select
                      value={STANDARD_KVA_SIZES.map(String).includes(panel.transformer!.kva) ? panel.transformer!.kva : (panel.transformer!.kva ? '__custom__' : '')}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          handleTransformerKva(panel.transformer!.kva || '');
                        } else {
                          handleTransformerKva(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select kVA...</option>
                      {STANDARD_KVA_SIZES.map((k) => (
                        <option key={k} value={String(k)}>{k} kVA</option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                    {panel.transformer!.kva && !STANDARD_KVA_SIZES.map(String).includes(panel.transformer!.kva) && (
                      <input
                        type="number"
                        value={panel.transformer!.kva}
                        onChange={(e) => handleTransformerKva(e.target.value)}
                        placeholder="Enter kVA"
                        min="0"
                        style={{ marginTop: '0.25rem' }}
                      />
                    )}
                  </label>

                  <label>
                    Primary ({panel.transformer!.primaryVoltage})
                    <input
                      type="text"
                      value={xfPrimaryFLA > 0 ? `${xfPrimaryFLA.toFixed(1)}A FLA` : '--'}
                      readOnly
                      className="computed-field"
                    />
                  </label>
                  <label>
                    Secondary ({panel.transformer!.secondaryVoltage})
                    <input
                      type="text"
                      value={xfSecondaryFLA > 0 ? `${xfSecondaryFLA.toFixed(1)}A FLA` : '--'}
                      readOnly
                      className="computed-field"
                    />
                  </label>
                </>
              )}
            </div>

            {/* Transformer warnings */}
            {hasTransformer && xfKva > 0 && xfSecondaryFLA > 0 && (
              <>
                {Number(panel.mainBreakerAmps) > 0 && Number(panel.mainBreakerAmps) > Math.ceil(xfSecondaryFLA) && (
                  <div className="calc-alert warning" style={{ marginBottom: '0.5rem' }}>
                    Main breaker ({panel.mainBreakerAmps}A) exceeds transformer secondary FLA ({xfSecondaryFLA.toFixed(1)}A).
                  </div>
                )}
                {totalBreakerAmps > xfSecondaryFLA && (
                  <div className="calc-alert warning" style={{ marginBottom: '0.5rem' }}>
                    Total breaker load ({totalBreakerAmps}A) exceeds transformer capacity ({xfSecondaryFLA.toFixed(1)}A secondary).
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="form-grid">
          <label>
            Status
            <select
              value={panel.condition || 'existing'}
              onChange={(e) => updateField('condition', e.target.value)}
            >
              <option value="existing">Existing</option>
              <option value="new">New / Proposed</option>
            </select>
          </label>
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
          <AmpsSelect
            label="Main Breaker (Amps)"
            value={panel.mainBreakerAmps}
            onChange={(v) => updateField('mainBreakerAmps', v)}
          />
          <AmpsSelect
            label="Bus Rating (Amps)"
            value={panel.busRatingAmps}
            onChange={(v) => updateField('busRatingAmps', v)}
          />
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
            Unused / Spare Spaces
            <input
              type="number"
              value={panel.spareSpaces || ''}
              onChange={(e) => updateField('spareSpaces', e.target.value)}
              placeholder="0"
              min="0"
            />
          </label>
          <label>
            Spaces Accounted
            <input
              type="text"
              value={totalSp > 0 ? `${accountedSpaces} of ${totalSp} (${spacesUsed} breakers + ${spareCount} spare)` : '--'}
              readOnly
              className={`computed-field${totalSp > 0 && accountedSpaces !== totalSp ? ' spaces-mismatch' : ''}`}
            />
          </label>
        </div>

        <div className="breakers-section">
          <div className="breakers-header">
            <h4>Breakers</h4>
            <span className="breaker-summary">
              {totalBreakerAmps > 0 && `${totalBreakerAmps}A total load`}
              {totalPanelKw > 0 && ` / ${totalPanelKw.toFixed(1)} kW`}
              {totalSp > 0 && ` | ${accountedSpaces}/${totalSp} spaces`}
            </span>
          </div>

          {panel.breakers.length > 0 && (
            <table className="breakers-table">
              <thead>
                <tr>
                  <th>Ckt #</th>
                  <th>Label</th>
                  <th>Breaker</th>
                  <th>Voltage</th>
                  <th>Sp</th>
                  <th>Type</th>
                  <th>kW</th>
                  <th>Load</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panel.breakers.map((breaker) => (
                  <BreakerRow
                    key={breaker.id}
                    breaker={breaker}
                    panelId={panel.id}
                    serviceVoltage={effectiveVoltage}
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
            <button type="button" className="btn-add btn-small btn-ev" onClick={() => onAddEvCharger(panel.id)}>
              + Add EV Charger
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
          {totalSp > 0 && availableSpaces > 0 && (
            <div className="calc-alert caution" style={{ marginTop: '0.5rem' }}>
              {availableSpaces} space{availableSpaces > 1 ? 's' : ''} unaccounted for ({accountedSpaces} of {totalSp} accounted: {spacesUsed} breakers + {spareCount} spare).
            </div>
          )}
        </div>
      </fieldset>

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
          onAddEvCharger={onAddEvCharger}
          onUpdateBreaker={onUpdateBreaker}
          onRemoveBreaker={onRemoveBreaker}
          onAddSubPanel={onAddSubPanel}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function BreakerRow({
  breaker,
  panelId,
  serviceVoltage,
  voltageOptions,
  onUpdate,
  onRemove,
}: {
  breaker: Breaker;
  panelId: string;
  serviceVoltage: string;
  voltageOptions: { value: string; label: string }[];
  onUpdate: (panelId: string, breakerId: string, updated: Breaker) => void;
  onRemove: (panelId: string, breakerId: string) => void;
}) {
  const update = (field: keyof Breaker, value: string) => {
    onUpdate(panelId, breaker.id, { ...breaker, [field]: value });
  };

  const spaces = breakerSpaces(breaker.voltage);
  const isSubPanel = breaker.type === 'subpanel';
  const isEv = breaker.type === 'evcharger';

  // EV charger voltage is simply the breaker voltage
  const evVoltage = isEv ? Number(breaker.voltage) || 0 : 0;
  const evKw = isEv ? calcKw(String(evVoltage), breaker.chargerAmps || '') : 0;

  return (
    <>
      <tr className={isSubPanel ? 'breaker-row-subpanel' : isEv ? 'breaker-row-ev' : ''}>
        <td>
          <input
            type="text"
            value={breaker.circuitNumber}
            onChange={(e) => update('circuitNumber', e.target.value)}
            className={spaces > 1 ? 'ckt-input-2p' : 'ckt-input'}
            placeholder={spaces > 1 ? '#,#' : '#'}
          />
        </td>
        <td>
          {isSubPanel ? (
            <span className="subpanel-label">{breaker.label || 'Sub Panel'}</span>
          ) : isEv ? (
            <input
              type="text"
              value={breaker.label}
              onChange={(e) => update('label', e.target.value)}
              placeholder="EV Charger label"
              style={{ width: '100%' }}
            />
          ) : (
            <>
              <select
                value={COMMON_LOADS.includes(breaker.label) ? breaker.label : (breaker.label ? 'Other' : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  update('label', val === 'Other' ? '' : val);
                }}
              >
                <option value="">Select...</option>
                {LOAD_CATEGORIES.map((cat) => (
                  <optgroup key={cat.category} label={cat.category}>
                    {cat.loads.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="Other">Other</option>
              </select>
              {!COMMON_LOADS.includes(breaker.label) && (
                <input
                  type="text"
                  placeholder="Describe..."
                  value={breaker.label}
                  onChange={(e) => update('label', e.target.value)}
                  style={{ marginTop: '0.2rem', width: '100%' }}
                />
              )}
            </>
          )}
        </td>
        <td>
          <select
            value={STANDARD_BREAKER_SIZES.map(String).includes(breaker.amps) ? breaker.amps : ''}
            onChange={(e) => update('amps', e.target.value)}
            className="amps-select"
          >
            <option value="">--</option>
            {STANDARD_BREAKER_SIZES.map((s) => (
              <option key={s} value={String(s)}>{s}A</option>
            ))}
          </select>
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
          ) : isEv ? (
            <span className={`type-badge ${breaker.chargerLevel === 'Level 3' ? 'type-dcfc' : 'type-ev'}`}>
              {breaker.chargerLevel === 'Level 3' ? 'DCFC' : 'EV'}{evKw > 0 ? ` ${evKw.toFixed(1)}kW` : ''}
            </span>
          ) : (
            <span className="type-badge type-load">Load</span>
          )}
        </td>
        <td className="kw-cell">
          {isSubPanel ? '--' : isEv
            ? (evChargerKw(breaker) > 0 ? `${evChargerKw(breaker).toFixed(1)}` : '--')
            : (breakerKva(breaker) > 0 ? `${breakerKva(breaker).toFixed(1)}` : '--')
          }
        </td>
        <td>
          {!isSubPanel && (
            <select
              value={breaker.loadType || 'noncontinuous'}
              onChange={(e) => update('loadType', e.target.value)}
              className="load-type-select"
            >
              <option value="noncontinuous">Non-Cont</option>
              <option value="continuous">Cont</option>
            </select>
          )}
        </td>
        <td>
          <select
            value={breaker.condition || 'existing'}
            onChange={(e) => update('condition', e.target.value)}
            className="condition-select"
          >
            <option value="existing">Existing</option>
            <option value="new">New</option>
          </select>
        </td>
        <td>
          <button type="button" className="btn-remove btn-remove-sm" onClick={() => onRemove(panelId, breaker.id)}>
            &times;
          </button>
        </td>
      </tr>
      {/* EV charger detail row */}
      {isEv && (
        <tr className="breaker-row-ev-detail">
          <td></td>
          <td colSpan={9}>
            <div className="ev-detail-grid">
              <label>
                Level
                <select
                  value={breaker.chargerLevel || ''}
                  onChange={(e) => {
                    const level = e.target.value;
                    // Auto-set breaker voltage to match level + panel voltage
                    const autoVolts = level ? String(chargerVoltage(level, serviceVoltage)) : breaker.voltage;
                    onUpdate(panelId, breaker.id, {
                      ...breaker,
                      chargerLevel: level,
                      voltage: autoVolts,
                    });
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Level 1">Level 1 (120V AC)</option>
                  <option value="Level 2">Level 2 ({serviceVoltage === '120/208V' ? '208V' : '240V'} AC)</option>
                  <option value="Level 3">Level 3 DCFC (480V)</option>
                </select>
              </label>
              <label>
                Charger Amps
                <input
                  type="number"
                  value={breaker.chargerAmps || ''}
                  onChange={(e) => update('chargerAmps', e.target.value)}
                  placeholder="e.g. 32"
                  min="0"
                />
              </label>
              <label>
                # Ports
                <input
                  type="number"
                  value={breaker.chargerPorts || ''}
                  onChange={(e) => update('chargerPorts', e.target.value)}
                  placeholder="e.g. 1"
                  min="1"
                />
              </label>
              <label>
                kW Output
                <input
                  type="text"
                  value={evKw > 0 ? `${evKw.toFixed(1)} kW` : '--'}
                  readOnly
                  className="computed-field"
                />
              </label>
              <label>
                Wire Run (ft)
                <input
                  type="number"
                  value={breaker.wireRunFeet || ''}
                  onChange={(e) => update('wireRunFeet', e.target.value)}
                  min="0"
                />
              </label>
              <label>
                Wire Size
                <select
                  value={breaker.wireSize || ''}
                  onChange={(e) => update('wireSize', e.target.value)}
                >
                  <option value="">--</option>
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
                Conduit
                <select
                  value={breaker.conduitType || ''}
                  onChange={(e) => update('conduitType', e.target.value)}
                >
                  <option value="">--</option>
                  <option value="EMT">EMT</option>
                  <option value="PVC">PVC</option>
                  <option value="Flex">Flex</option>
                  <option value="MC Cable">MC Cable</option>
                  <option value="NM-B">NM-B</option>
                  <option value="Direct Burial">Direct Burial</option>
                </select>
              </label>
              <label className="ev-detail-full">
                Install Location
                <input
                  type="text"
                  value={breaker.installLocation || ''}
                  onChange={(e) => update('installLocation', e.target.value)}
                  placeholder="e.g. Left wall of garage, 4ft from floor"
                />
              </label>
            </div>
            {/* NEC 625.40 – 125% continuous load breaker sizing */}
            {(() => {
              const cAmps = Number(breaker.chargerAmps) || 0;
              const bAmps = Number(breaker.amps) || 0;
              if (cAmps <= 0) return null;
              const minAmps = minBreakerAmpsForEv(cAmps);
              const suggested = nextBreakerSize(minAmps);
              if (bAmps > 0 && bAmps < minAmps) {
                return (
                  <div className="calc-alert warning" style={{ marginTop: '0.4rem' }}>
                    NEC 625.40: Breaker ({bAmps}A) must be {'\u2265'} 125% of charger amps ({cAmps}A = {minAmps}A min). Use {suggested}A breaker.
                  </div>
                );
              }
              if (bAmps === 0) {
                return (
                  <div className="calc-alert info" style={{ marginTop: '0.4rem' }}>
                    NEC 625.40: {cAmps}A charger requires {'\u2265'} {minAmps}A breaker ({suggested}A recommended).
                  </div>
                );
              }
              return null;
            })()}
          </td>
        </tr>
      )}
    </>
  );
}
