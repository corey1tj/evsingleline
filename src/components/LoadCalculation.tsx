import type { SingleLineData } from '../types';

interface Props {
  data: SingleLineData;
}

export function LoadCalculation({ data }: Props) {
  const serviceAmps = Number(data.serviceEntrance.serviceAmperage) || 0;

  // Use the first panel as the "main" panel for overall capacity calculation
  const firstPanel = data.panels[0];
  const mainBreakerAmps = firstPanel ? Number(firstPanel.mainBreakerAmps) || 0 : 0;
  const panelRating = Math.min(serviceAmps, mainBreakerAmps) || serviceAmps || mainBreakerAmps;

  const existingLoadAmps = data.existingLoads.reduce(
    (sum, l) => sum + (Number(l.breakerAmps) || 0),
    0
  );

  const totalEvBreakerAmps = data.evChargers.reduce(
    (sum, c) => sum + (Number(c.breakerSize) || 0),
    0
  );

  const totalAfterEV = existingLoadAmps + totalEvBreakerAmps;
  const capacityUsed = panelRating > 0 ? Math.round((totalAfterEV / panelRating) * 100) : 0;

  const totalAvailableSpaces = data.panels.reduce(
    (sum, p) => sum + (Number(p.availableSpaces) || 0),
    0
  );

  const totalEvSpacesNeeded = data.evChargers.reduce(
    (sum, c) => {
      const breaker = Number(c.breakerSize) || 0;
      if (breaker === 0) return sum;
      return sum + (breaker > 30 ? 2 : 1);
    },
    0
  );

  const spacesOk = totalAvailableSpaces >= totalEvSpacesNeeded;

  if (panelRating === 0 && existingLoadAmps === 0 && totalEvBreakerAmps === 0) {
    return null;
  }

  return (
    <fieldset className="load-calc">
      <legend>Load Calculation Summary</legend>
      <div className="calc-grid">
        <div className="calc-row">
          <span>Panel Rating (Primary)</span>
          <span>{panelRating > 0 ? `${panelRating}A` : '--'}</span>
        </div>
        <div className="calc-row">
          <span>Existing Breaker Load</span>
          <span>{existingLoadAmps}A</span>
        </div>
        <div className="calc-row">
          <span>Proposed EV Breakers ({data.evChargers.length})</span>
          <span>{totalEvBreakerAmps > 0 ? `${totalEvBreakerAmps}A` : '--'}</span>
        </div>
        {data.evChargers.length > 1 && (
          <div className="calc-detail">
            {data.evChargers.map((c, i) => {
              const amps = Number(c.breakerSize) || 0;
              if (amps === 0) return null;
              return (
                <div key={c.id} className="calc-row sub">
                  <span>{c.chargerLabel || `EV Charger ${i + 1}`}</span>
                  <span>{amps}A</span>
                </div>
              );
            })}
          </div>
        )}
        <hr />
        <div className="calc-row total">
          <span>Total After EV</span>
          <span>{totalAfterEV}A</span>
        </div>
        {panelRating > 0 && (
          <div className={`calc-row ${capacityUsed > 100 ? 'warning' : capacityUsed > 80 ? 'caution' : 'ok'}`}>
            <span>Capacity Used</span>
            <span>{capacityUsed}%</span>
          </div>
        )}
        {capacityUsed > 100 && (
          <div className="calc-alert warning">
            Total breaker load exceeds panel rating. A service upgrade or load management device may be required.
          </div>
        )}
        {capacityUsed > 80 && capacityUsed <= 100 && (
          <div className="calc-alert caution">
            Panel is above 80% capacity. Consider NEC load calculation to verify.
          </div>
        )}
        <hr />
        <div className="calc-row">
          <span>Available Panel Spaces (All Panels)</span>
          <span>{totalAvailableSpaces}</span>
        </div>
        {data.panels.length > 1 && (
          <div className="calc-detail">
            {data.panels.map((p, i) => {
              const spaces = Number(p.availableSpaces) || 0;
              return (
                <div key={p.id} className="calc-row sub">
                  <span>{p.panelName || `Panel ${i + 1}`}</span>
                  <span>{spaces} spaces</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="calc-row">
          <span>Spaces Needed for EV</span>
          <span>{totalEvSpacesNeeded}</span>
        </div>
        <div className={`calc-row ${spacesOk ? 'ok' : 'warning'}`}>
          <span>Panel Space</span>
          <span>{spacesOk ? 'Sufficient' : 'Insufficient'}</span>
        </div>
      </div>
    </fieldset>
  );
}
