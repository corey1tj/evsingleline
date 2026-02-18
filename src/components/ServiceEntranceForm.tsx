import type { ServiceEntrance } from '../types';

interface Props {
  data: ServiceEntrance;
  onChange: (data: ServiceEntrance) => void;
}

export function ServiceEntranceForm({ data, onChange }: Props) {
  const update = (field: keyof ServiceEntrance, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <fieldset>
      <legend>Service Entrance</legend>
      <div className="form-grid">
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
