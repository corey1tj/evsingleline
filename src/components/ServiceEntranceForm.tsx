import type { ServiceEntrance } from '../types';

interface Props {
  data: ServiceEntrance;
  onChange: (data: ServiceEntrance) => void;
}

const COMMON_AMPS = ['100', '125', '150', '200', '225', '300', '400', '600', '800', '1000', '1200', '1600', '2000'];

export function ServiceEntranceForm({ data, onChange }: Props) {
  const update = (field: keyof ServiceEntrance, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const isCustomAmps = data.serviceAmperage !== '' && !COMMON_AMPS.includes(data.serviceAmperage);

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
            value={isCustomAmps ? '__custom__' : data.serviceAmperage}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                update('serviceAmperage', data.serviceAmperage || '');
              } else {
                update('serviceAmperage', e.target.value);
              }
            }}
          >
            <option value="">Select...</option>
            {COMMON_AMPS.map((a) => (
              <option key={a} value={a}>{a}A</option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
          {isCustomAmps && (
            <input
              type="number"
              value={data.serviceAmperage}
              onChange={(e) => update('serviceAmperage', e.target.value)}
              placeholder="Enter amps"
              min="0"
              style={{ marginTop: '0.25rem' }}
            />
          )}
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
