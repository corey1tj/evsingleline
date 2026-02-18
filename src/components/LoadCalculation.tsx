import type { SingleLineData, MainPanel } from '../types';
import { totalSpacesUsed, calcKw } from '../types';

interface Props {
  data: SingleLineData;
}

function chargerVoltage(level: string, serviceVoltage: string): number {
  if (level === 'Level 1') return 120;
  switch (serviceVoltage) {
    case '120/208V': return 208;
    case '277/480V': return 480;
    default: return 240;
  }
}

/** Get total breaker amps for a panel (loads only, not sub-panel feeds) */
function panelLoadAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'load')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

/** Get the feed breaker amps for sub-panel breakers on this panel */
function panelSubPanelFeedAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'subpanel')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

export function LoadCalculation({ data }: Props) {
  const serviceAmps = Number(data.serviceEntrance.serviceAmperage) || 0;
  const serviceVoltage = data.serviceEntrance.serviceVoltage;

  // Find root panel (MDP)
  const rootPanels = data.panels.filter((p) => !p.parentPanelId);
  const mdp = rootPanels[0];
  const mdpBreakerAmps = mdp ? Number(mdp.mainBreakerAmps) || 0 : 0;
  const panelRating = Math.min(serviceAmps, mdpBreakerAmps) || serviceAmps || mdpBreakerAmps;

  // Total existing breaker load across ALL panels (loads only)
  const totalExistingLoadAmps = data.panels.reduce(
    (sum, p) => sum + panelLoadAmps(p),
    0
  );

  // Total EV charger breaker amps
  const totalEvBreakerAmps = data.evChargers.reduce(
    (sum, c) => sum + (Number(c.breakerSize) || 0),
    0
  );

  // Total kW for all chargers
  const totalEvKw = data.evChargers.reduce((sum, c) => {
    const v = chargerVoltage(c.chargerLevel, serviceVoltage);
    return sum + calcKw(String(v), c.chargerAmps);
  }, 0);

  const totalAfterEV = totalExistingLoadAmps + totalEvBreakerAmps;
  const capacityUsed = panelRating > 0 ? Math.round((totalAfterEV / panelRating) * 100) : 0;

  // Space calculations per panel
  const evSpacesNeeded = data.evChargers.reduce(
    (sum, c) => {
      const breaker = Number(c.breakerSize) || 0;
      if (breaker === 0) return sum;
      return sum + (breaker > 30 ? 2 : 1);
    },
    0
  );

  // Panel-level summaries
  const panelSummaries = data.panels.map((p) => {
    const totalSp = Number(p.totalSpaces) || 0;
    const used = totalSpacesUsed(p.breakers);
    // Add EV charger spaces assigned to this panel
    const evOnPanel = data.evChargers.filter((c) => c.panelId === p.id);
    const evSpaces = evOnPanel.reduce((s, c) => {
      const bs = Number(c.breakerSize) || 0;
      return s + (bs > 30 ? 2 : 1);
    }, 0);
    const evAmps = evOnPanel.reduce((s, c) => s + (Number(c.breakerSize) || 0), 0);
    const loadAmps = panelLoadAmps(p);
    const subFeedAmps = panelSubPanelFeedAmps(p);
    const totalUsedWithEv = used + evSpaces;
    const available = totalSp - totalUsedWithEv;
    const mainBreaker = Number(p.mainBreakerAmps) || 0;
    const totalLoadOnPanel = loadAmps + subFeedAmps + evAmps;
    const overloaded = mainBreaker > 0 && totalLoadOnPanel > mainBreaker;

    return {
      panel: p,
      totalSpaces: totalSp,
      spacesUsed: used,
      evSpaces,
      totalUsedWithEv,
      available,
      loadAmps,
      subFeedAmps,
      evAmps,
      totalLoadOnPanel,
      mainBreaker,
      overloaded,
    };
  });

  // Check sub-panel alignment: sub-panel's total load should not exceed its feed breaker
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

    const subTotalLoad = panelLoadAmps(p) + panelSubPanelFeedAmps(p);
    const evOnSub = data.evChargers.filter((c) => c.panelId === p.id).reduce((s, c) => s + (Number(c.breakerSize) || 0), 0);
    const totalOnSub = subTotalLoad + evOnSub;
    if (feedAmps > 0 && totalOnSub > feedAmps) {
      alignmentWarnings.push(
        `${p.panelName || 'Sub Panel'}: Total load (${totalOnSub}A) exceeds feed breaker (${feedAmps}A) from ${parent.panelName || 'parent panel'}.`
      );
    }
  }

  if (panelRating === 0 && totalExistingLoadAmps === 0 && totalEvBreakerAmps === 0) {
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
          <span>Existing Breaker Loads (All Panels)</span>
          <span>{totalExistingLoadAmps}A</span>
        </div>

        {/* Per-panel breakdown */}
        {data.panels.length > 0 && (
          <div className="calc-detail">
            {panelSummaries.map((ps, i) => (
              <div key={ps.panel.id} className={`calc-row sub ${ps.overloaded ? 'warning' : ''}`}>
                <span>{ps.panel.panelName || `Panel ${i + 1}`}</span>
                <span>{ps.loadAmps}A load{ps.subFeedAmps > 0 ? ` + ${ps.subFeedAmps}A sub feeds` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div className="calc-row">
          <span>Proposed EV Breakers ({data.evChargers.length})</span>
          <span>{totalEvBreakerAmps > 0 ? `${totalEvBreakerAmps}A` : '--'}</span>
        </div>

        {data.evChargers.length > 0 && (
          <div className="calc-detail">
            {data.evChargers.map((c, i) => {
              const amps = Number(c.breakerSize) || 0;
              const v = chargerVoltage(c.chargerLevel, serviceVoltage);
              const kw = calcKw(String(v), c.chargerAmps);
              const panelName = data.panels.find((p) => p.id === c.panelId)?.panelName || '';
              if (amps === 0 && kw === 0) return null;
              return (
                <div key={c.id} className="calc-row sub">
                  <span>
                    {c.chargerLabel || `EV Charger ${i + 1}`}
                    {panelName && <span className="calc-panel-tag"> ({panelName})</span>}
                  </span>
                  <span>
                    {amps > 0 ? `${amps}A` : '--'}
                    {kw > 0 ? ` / ${kw.toFixed(1)}kW` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {totalEvKw > 0 && (
          <div className="calc-row">
            <span>Total EV Output</span>
            <span>{totalEvKw.toFixed(1)} kW</span>
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

        {/* Panel space summary */}
        <div className="calc-row" style={{ fontWeight: 600 }}>
          <span>Panel Space Summary</span>
          <span></span>
        </div>
        {panelSummaries.map((ps, i) => {
          const totalSp = ps.totalSpaces;
          if (totalSp === 0) return null;
          const ok = ps.available >= 0;
          return (
            <div key={ps.panel.id} className={`calc-row sub ${ok ? '' : 'warning'}`}>
              <span>{ps.panel.panelName || `Panel ${i + 1}`}</span>
              <span>
                {ps.totalUsedWithEv}/{totalSp} used
                {ps.evSpaces > 0 ? ` (incl. ${ps.evSpaces} EV)` : ''}
                {!ok ? ' - FULL' : ''}
              </span>
            </div>
          );
        })}

        <div className="calc-row">
          <span>EV Spaces Needed (Total)</span>
          <span>{evSpacesNeeded}</span>
        </div>

        {/* Alignment warnings */}
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

        {/* Per-panel overload warnings */}
        {panelSummaries.filter((ps) => ps.overloaded).map((ps) => (
          <div key={ps.panel.id} className="calc-alert warning" style={{ marginTop: '0.5rem' }}>
            {ps.panel.panelName || 'Panel'}: Total load ({ps.totalLoadOnPanel}A) exceeds main breaker ({ps.mainBreaker}A).
          </div>
        ))}
      </div>
    </fieldset>
  );
}
