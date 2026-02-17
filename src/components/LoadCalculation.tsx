import type { SingleLineData } from '../types';

interface Props {
  data: SingleLineData;
}

export function LoadCalculation({ data }: Props) {
  const serviceAmps = Number(data.serviceEntrance.serviceAmperage) || 0;
  const mainBreakerAmps = Number(data.mainPanel.mainBreakerAmps) || 0;
  const panelRating = Math.min(serviceAmps, mainBreakerAmps) || serviceAmps || mainBreakerAmps;

  const existingLoadAmps = data.existingLoads.reduce(
    (sum, l) => sum + (Number(l.breakerAmps) || 0),
    0
  );

  const evBreakerAmps = Number(data.evCharger.breakerSize) || 0;
  const totalAfterEV = existingLoadAmps + evBreakerAmps;
  const capacityUsed = panelRating > 0 ? Math.round((totalAfterEV / panelRating) * 100) : 0;

  const availableSpaces = Number(data.mainPanel.availableSpaces) || 0;
  const evSpacesNeeded = evBreakerAmps > 0 ? (Number(data.evCharger.breakerSize) > 30 ? 2 : 1) : 0;
  const spacesOk = availableSpaces >= evSpacesNeeded;

  if (panelRating === 0 && existingLoadAmps === 0 && evBreakerAmps === 0) {
    return null;
  }

  return (
    <fieldset className="load-calc">
      <legend>Load Calculation Summary</legend>
      <div className="calc-grid">
        <div className="calc-row">
          <span>Panel Rating</span>
          <span>{panelRating > 0 ? `${panelRating}A` : '--'}</span>
        </div>
        <div className="calc-row">
          <span>Existing Breaker Load</span>
          <span>{existingLoadAmps}A</span>
        </div>
        <div className="calc-row">
          <span>Proposed EV Breaker</span>
          <span>{evBreakerAmps > 0 ? `${evBreakerAmps}A` : '--'}</span>
        </div>
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
          <span>Available Panel Spaces</span>
          <span>{availableSpaces}</span>
        </div>
        <div className="calc-row">
          <span>Spaces Needed for EV</span>
          <span>{evSpacesNeeded}</span>
        </div>
        <div className={`calc-row ${spacesOk ? 'ok' : 'warning'}`}>
          <span>Panel Space</span>
          <span>{spacesOk ? 'Sufficient' : 'Insufficient'}</span>
        </div>
      </div>
    </fieldset>
  );
}
