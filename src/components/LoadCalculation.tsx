import type { SingleLineData, MainPanel } from '../types';
import { totalSpacesUsed, calcKw, chargerVoltage } from '../types';

interface Props {
  data: SingleLineData;
}

function panelLoadAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'load' || b.type === 'evcharger')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

function panelSubPanelFeedAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'subpanel')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

export function LoadCalculation({ data }: Props) {
  const serviceAmps = Number(data.serviceEntrance.serviceAmperage) || 0;
  const serviceVoltage = data.serviceEntrance.serviceVoltage;

  const rootPanels = data.panels.filter((p) => !p.parentPanelId);
  const mdp = rootPanels[0];
  const mdpBreakerAmps = mdp ? Number(mdp.mainBreakerAmps) || 0 : 0;
  const panelRating = Math.min(serviceAmps, mdpBreakerAmps) || serviceAmps || mdpBreakerAmps;

  // All breaker loads across all panels (loads + ev chargers, not sub-panel feeds)
  const totalLoadAmps = data.panels.reduce(
    (sum, p) => sum + panelLoadAmps(p),
    0
  );

  // EV charger breakers only
  const allEvBreakers = data.panels.flatMap((p) => p.breakers.filter((b) => b.type === 'evcharger'));
  const totalEvBreakerAmps = allEvBreakers.reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
  const existingLoadAmps = totalLoadAmps - totalEvBreakerAmps;

  const totalEvKw = allEvBreakers.reduce((sum, b) => {
    const v = chargerVoltage(b.chargerLevel || '', serviceVoltage);
    return sum + calcKw(String(v), b.chargerAmps || '');
  }, 0);

  const capacityUsed = panelRating > 0 ? Math.round((totalLoadAmps / panelRating) * 100) : 0;

  // Panel-level summaries
  const panelSummaries = data.panels.map((p) => {
    const totalSp = Number(p.totalSpaces) || 0;
    const used = totalSpacesUsed(p.breakers);
    const available = totalSp - used;
    const loadAmps = panelLoadAmps(p);
    const subFeedAmps = panelSubPanelFeedAmps(p);
    const mainBreaker = Number(p.mainBreakerAmps) || 0;
    const totalOnPanel = loadAmps + subFeedAmps;
    const overloaded = mainBreaker > 0 && totalOnPanel > mainBreaker;
    const evBreakers = p.breakers.filter((b) => b.type === 'evcharger');

    return {
      panel: p,
      totalSpaces: totalSp,
      spacesUsed: used,
      available,
      loadAmps,
      subFeedAmps,
      totalOnPanel,
      mainBreaker,
      overloaded,
      evBreakers,
    };
  });

  // Sub-panel alignment warnings
  const alignmentWarnings: string[] = [];
  for (const p of data.panels) {
    if (!p.parentPanelId || !p.feedBreakerId) continue;
    const parent = data.panels.find((pp) => pp.id === p.parentPanelId);
    if (!parent) continue;
    const feedBreaker = parent.breakers.find((b) => b.id === p.feedBreakerId);
    if (!feedBreaker) continue;
    const feedAmps = Number(feedBreaker.amps) || 0;
    const subMainBreaker = Number(p.mainBreakerAmps) || 0;

    if (feedAmps > 0 && subMainBreaker > 0 && subMainBreaker > feedAmps) {
      alignmentWarnings.push(
        `${p.panelName || 'Sub Panel'}: Main breaker (${subMainBreaker}A) exceeds feed breaker (${feedAmps}A) on ${parent.panelName || 'parent panel'}.`
      );
    }

    const subTotal = panelLoadAmps(p) + panelSubPanelFeedAmps(p);
    if (feedAmps > 0 && subTotal > feedAmps) {
      alignmentWarnings.push(
        `${p.panelName || 'Sub Panel'}: Total load (${subTotal}A) exceeds feed breaker (${feedAmps}A) from ${parent.panelName || 'parent panel'}.`
      );
    }
  }

  if (panelRating === 0 && totalLoadAmps === 0) {
    return null;
  }

  return (
    <fieldset className="load-calc">
      <legend>Load Calculation Summary</legend>
      <div className="calc-grid">
        <div className="calc-row">
          <span>Service / MDP Rating</span>
          <span>{panelRating > 0 ? `${panelRating}A` : '--'}</span>
        </div>
        <div className="calc-row">
          <span>Existing Breaker Loads</span>
          <span>{existingLoadAmps}A</span>
        </div>

        {data.panels.length > 0 && (
          <div className="calc-detail">
            {panelSummaries.map((ps, i) => (
              <div key={ps.panel.id} className={`calc-row sub ${ps.overloaded ? 'warning' : ''}`}>
                <span>{ps.panel.panelName || `Panel ${i + 1}`}</span>
                <span>{ps.loadAmps}A{ps.subFeedAmps > 0 ? ` + ${ps.subFeedAmps}A feeds` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {allEvBreakers.length > 0 && (
          <>
            <div className="calc-row">
              <span>EV Charger Breakers ({allEvBreakers.length})</span>
              <span>{totalEvBreakerAmps}A</span>
            </div>
            <div className="calc-detail">
              {allEvBreakers.map((b) => {
                const v = chargerVoltage(b.chargerLevel || '', serviceVoltage);
                const kw = calcKw(String(v), b.chargerAmps || '');
                const panelName = data.panels.find((p) => p.breakers.some((br) => br.id === b.id))?.panelName || '';
                return (
                  <div key={b.id} className="calc-row sub">
                    <span>
                      {b.label || 'EV Charger'}
                      {panelName && <span className="calc-panel-tag"> ({panelName})</span>}
                    </span>
                    <span>
                      {b.amps ? `${b.amps}A` : '--'}
                      {kw > 0 ? ` / ${kw.toFixed(1)}kW` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {totalEvKw > 0 && (
          <div className="calc-row">
            <span>Total EV Output</span>
            <span>{totalEvKw.toFixed(1)} kW</span>
          </div>
        )}

        <hr />
        <div className="calc-row total">
          <span>Total Load</span>
          <span>{totalLoadAmps}A</span>
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

        <div className="calc-row" style={{ fontWeight: 600 }}>
          <span>Panel Space Summary</span>
          <span></span>
        </div>
        {panelSummaries.map((ps, i) => {
          if (ps.totalSpaces === 0) return null;
          const ok = ps.available >= 0;
          return (
            <div key={ps.panel.id} className={`calc-row sub ${ok ? '' : 'warning'}`}>
              <span>{ps.panel.panelName || `Panel ${i + 1}`}</span>
              <span>
                {ps.spacesUsed}/{ps.totalSpaces} used
                {!ok ? ' - FULL' : ''}
              </span>
            </div>
          );
        })}

        {alignmentWarnings.length > 0 && (
          <>
            <hr />
            {alignmentWarnings.map((w, i) => (
              <div key={i} className="calc-alert warning">
                {w}
              </div>
            ))}
          </>
        )}

        {panelSummaries.filter((ps) => ps.overloaded).map((ps) => (
          <div key={ps.panel.id} className="calc-alert warning" style={{ marginTop: '0.5rem' }}>
            {ps.panel.panelName || 'Panel'}: Total load ({ps.totalOnPanel}A) exceeds main breaker ({ps.mainBreaker}A).
          </div>
        ))}
      </div>
    </fieldset>
  );
}
