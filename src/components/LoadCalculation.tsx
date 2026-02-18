import type { SingleLineData } from '../types';
import { minBreakerForContinuousLoad } from '../types';

interface Props {
  data: SingleLineData;
}

export function LoadCalculation({ data }: Props) {
  if (data.services.length === 0 && data.panels.length === 0) return null;

  // Per-service calculations
  const serviceCalcs = data.services.map((svc) => {
    const servicePanels = data.panels.filter((p) => p.serviceId === svc.id);
    const mdp = servicePanels.find((p) => p.parentId === '');
    const serviceAmps = Number(svc.serviceAmperage) || 0;
    const mdpBreakerAmps = mdp ? Number(mdp.mainBreakerAmps) || 0 : 0;
    const panelRating = Math.min(serviceAmps, mdpBreakerAmps) || serviceAmps || mdpBreakerAmps;

    // Existing loads on panels in this service
    const servicePanelIds = servicePanels.map((p) => p.id);
    const serviceLoads = data.existingLoads.filter((l) => servicePanelIds.includes(l.panelId));
    const existingLoadAmps = serviceLoads.reduce((sum, l) => sum + (Number(l.breakerAmps) || 0), 0);

    // EV chargers on panels in this service
    const serviceChargers = data.evChargers.filter((c) => servicePanelIds.includes(c.panelId));
    const totalEvBreakerAmps = serviceChargers.reduce((sum, c) => sum + (Number(c.breakerSize) || 0), 0);

    const totalAfterEV = existingLoadAmps + totalEvBreakerAmps;
    const capacityUsed = panelRating > 0 ? Math.round((totalAfterEV / panelRating) * 100) : 0;

    // Available spaces
    const totalAvailableSpaces = servicePanels.reduce(
      (sum, p) => sum + (Number(p.availableSpaces) || 0), 0
    );
    const totalEvSpacesNeeded = serviceChargers.reduce((sum, c) => {
      const breaker = Number(c.breakerSize) || 0;
      if (breaker === 0) return sum;
      // L3 DCFC often uses 3-pole breakers (3 spaces)
      if (c.chargerLevel === 'Level 3 DCFC') return sum + 3;
      return sum + (breaker > 30 ? 2 : 1);
    }, 0);

    // 80% rule violations
    const breakerViolations = serviceChargers.filter((c) => {
      const cAmps = Number(c.chargerAmps) || 0;
      const bSize = Number(c.breakerSize) || 0;
      if (cAmps === 0 || bSize === 0) return false;
      return bSize < minBreakerForContinuousLoad(cAmps);
    });

    return {
      service: svc,
      mdp,
      panels: servicePanels,
      chargers: serviceChargers,
      loads: serviceLoads,
      panelRating,
      existingLoadAmps,
      totalEvBreakerAmps,
      totalAfterEV,
      capacityUsed,
      totalAvailableSpaces,
      totalEvSpacesNeeded,
      spacesOk: totalAvailableSpaces >= totalEvSpacesNeeded,
      breakerViolations,
    };
  });

  const hasData = serviceCalcs.some((sc) =>
    sc.panelRating > 0 || sc.existingLoadAmps > 0 || sc.totalEvBreakerAmps > 0
  );
  if (!hasData) return null;

  return (
    <fieldset className="load-calc">
      <legend>Load Calculation Summary</legend>

      {serviceCalcs.map((sc) => (
        <div key={sc.service.id} className="service-calc-block">
          {data.services.length > 1 && (
            <h3 className="service-calc-title">
              {sc.service.serviceName || 'Service'} &mdash; {sc.service.serviceVoltage || '?'}
            </h3>
          )}

          <div className="calc-grid">
            <div className="calc-row">
              <span>Service / MDP Rating</span>
              <span>{sc.panelRating > 0 ? `${sc.panelRating}A` : '--'}</span>
            </div>
            <div className="calc-row">
              <span>Existing Breaker Load</span>
              <span>{sc.existingLoadAmps}A</span>
            </div>
            <div className="calc-row">
              <span>Proposed EV Breakers ({sc.chargers.length})</span>
              <span>{sc.totalEvBreakerAmps > 0 ? `${sc.totalEvBreakerAmps}A` : '--'}</span>
            </div>

            {sc.chargers.length > 1 && (
              <div className="calc-detail">
                {sc.chargers.map((c, i) => {
                  const bAmps = Number(c.breakerSize) || 0;
                  if (bAmps === 0) return null;
                  return (
                    <div key={c.id} className="calc-row sub">
                      <span>{c.chargerLabel || `EV Charger ${i + 1}`}</span>
                      <span>{bAmps}A ({c.chargerLevel})</span>
                    </div>
                  );
                })}
              </div>
            )}

            <hr />
            <div className="calc-row total">
              <span>Total After EV</span>
              <span>{sc.totalAfterEV}A</span>
            </div>

            {sc.panelRating > 0 && (
              <div className={`calc-row ${sc.capacityUsed > 100 ? 'warning' : sc.capacityUsed > 80 ? 'caution' : 'ok'}`}>
                <span>Capacity Used</span>
                <span>{sc.capacityUsed}%</span>
              </div>
            )}

            {sc.capacityUsed > 100 && (
              <div className="calc-alert warning">
                Total breaker load exceeds service/panel rating. A service upgrade or load management device may be required.
              </div>
            )}
            {sc.capacityUsed > 80 && sc.capacityUsed <= 100 && (
              <div className="calc-alert caution">
                Service is above 80% capacity. Consider NEC load calculation to verify.
              </div>
            )}

            {sc.breakerViolations.length > 0 && (
              <div className="calc-alert warning">
                <strong>80% Continuous Load Violation:</strong>
                {sc.breakerViolations.map((c) => (
                  <div key={c.id}>
                    {c.chargerLabel || 'Charger'}: {c.chargerAmps}A continuous on {c.breakerSize}A breaker
                    (minimum {minBreakerForContinuousLoad(Number(c.chargerAmps))}A required)
                  </div>
                ))}
              </div>
            )}

            <hr />
            <div className="calc-row">
              <span>Available Panel Spaces</span>
              <span>{sc.totalAvailableSpaces}</span>
            </div>
            {sc.panels.length > 1 && (
              <div className="calc-detail">
                {sc.panels.map((p) => (
                  <div key={p.id} className="calc-row sub">
                    <span>{p.panelName || `Panel`} ({p.busVoltage}V)</span>
                    <span>{Number(p.availableSpaces) || 0} spaces</span>
                  </div>
                ))}
              </div>
            )}
            <div className="calc-row">
              <span>Spaces Needed for EV</span>
              <span>{sc.totalEvSpacesNeeded}</span>
            </div>
            <div className={`calc-row ${sc.spacesOk ? 'ok' : 'warning'}`}>
              <span>Panel Space</span>
              <span>{sc.spacesOk ? 'Sufficient' : 'Insufficient'}</span>
            </div>
          </div>
        </div>
      ))}
    </fieldset>
  );
}
