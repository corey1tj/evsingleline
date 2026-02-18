import type { ElectricalService } from '../types';

interface Props {
  data: ElectricalService;
  canRemove: boolean;
  onChange: (data: ElectricalService) => void;
  onRemove: () => void;
}

export function ServiceEntranceForm({ data, canRemove, onChange, onRemove }: Props) {
  const update = (field: keyof ElectricalService, value: string) => {
    const next = { ...data, [field]: value };
    // Auto-set phase when voltage is selected
    if (field === 'serviceVoltage') {
      if (value === '120/240V') next.servicePhase = 'single';
      else if (value === '120/208V' || value === '277/480V') next.servicePhase = 'three';
    }
    onChange(next);
  };

  return (
    <fieldset className="multi-item service-item">
      <legend>
        {data.serviceName || 'Service Entrance'}
        {canRemove && (
          <button type="button" className="btn-remove legend-remove" onClick={onRemove}>
            Remove Service
          </button>
        )}
      </legend>
      <div className="form-grid">
        <label>
          Service Name
          <input
            type="text"
            value={data.serviceName}
            onChange={(e) => update('serviceName', e.target.value)}
            placeholder="e.g. Main Service, DCFC Service"
          />
        </label>
        <label>
          Utility Provider
          <input
            type="text"
            value={data.utilityProvider}
            onChange={(e) => update('utilityProvider', e.target.value)}
          />
        </label>
        <label>
          Service Voltage
          <select
            value={data.serviceVoltage}
            onChange={(e) => update('serviceVoltage', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="120/240V">120/240V Single Phase</option>
            <option value="120/208V">120/208V Three Phase</option>
            <option value="277/480V">277/480V Three Phase</option>
          </select>
        </label>
        <label>
          Service Phase
          <select
            value={data.servicePhase}
            onChange={(e) => update('servicePhase', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="single">Single Phase</option>
            <option value="three">Three Phase</option>
          </select>
        </label>
        <label>
          Service Amperage
          <select
            value={data.serviceAmperage}
            onChange={(e) => update('serviceAmperage', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="100">100A</option>
            <option value="125">125A</option>
            <option value="150">150A</option>
            <option value="200">200A</option>
            <option value="225">225A</option>
            <option value="300">300A</option>
            <option value="400">400A</option>
            <option value="600">600A</option>
            <option value="800">800A</option>
            <option value="1000">1000A</option>
            <option value="1200">1200A</option>
            <option value="1600">1600A</option>
            <option value="2000">2000A</option>
            <option value="2500">2500A</option>
            <option value="3000">3000A</option>
            <option value="4000">4000A</option>
          </select>
        </label>
        <label>
          Meter Number
          <input
            type="text"
            value={data.meterNumber}
            onChange={(e) => update('meterNumber', e.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
