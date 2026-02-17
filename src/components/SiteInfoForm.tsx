import type { SiteInfo } from '../types';

interface Props {
  data: SiteInfo;
  onChange: (data: SiteInfo) => void;
}

export function SiteInfoForm({ data, onChange }: Props) {
  const update = (field: keyof SiteInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <fieldset>
      <legend>Site Information</legend>
      <div className="form-grid">
        <label>
          Customer Name
          <input
            type="text"
            value={data.customerName}
            onChange={(e) => update('customerName', e.target.value)}
          />
        </label>
        <label>
          Address
          <input
            type="text"
            value={data.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </label>
        <label>
          City
          <input
            type="text"
            value={data.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </label>
        <label>
          State
          <input
            type="text"
            value={data.state}
            onChange={(e) => update('state', e.target.value)}
            maxLength={2}
          />
        </label>
        <label>
          ZIP
          <input
            type="text"
            value={data.zip}
            onChange={(e) => update('zip', e.target.value)}
            maxLength={10}
          />
        </label>
        <label>
          Survey Date
          <input
            type="date"
            value={data.surveyDate}
            onChange={(e) => update('surveyDate', e.target.value)}
          />
        </label>
        <label>
          Technician Name
          <input
            type="text"
            value={data.technicianName}
            onChange={(e) => update('technicianName', e.target.value)}
          />
        </label>
        <label className="full-width">
          Notes
          <textarea
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
          />
        </label>
      </div>
    </fieldset>
  );
}
