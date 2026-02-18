import type { SingleLineData, MainPanel } from '../types';
import { totalSpacesUsed, calcKw, chargerVoltage, getEffectivePanelVoltage, transformerFLA, minBreakerAmpsForEv, nextBreakerSize } from '../types';

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
    const panelForBreaker = data.panels.find((p) => p.breakers.some((br) => br.id === b.id));
    const effVoltage = panelForBreaker
      ? getEffectivePanelVoltage(panelForBreaker, data.panels, serviceVoltage)
      : serviceVoltage;
    const v = chargerVoltage(b.chargerLevel || '', effVoltage, b.chargerVolts);
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

    // Transformer info
    const hasTransformer = !!p.transformer;
    const xfKva = Number(p.transformer?.kva) || 0;
    const xfSecondaryFLA = hasTransformer ? transformerFLA(xfKva, p.transformer!.secondaryVoltage) : 0;
    const xfOverloaded = hasTransformer && xfKva > 0 && xfSecondaryFLA > 0 && totalOnPanel > xfSecondaryFLA;

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
      hasTransformer,
      xfKva,
      xfSecondaryFLA,
      xfOverloaded,
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

    // Transformer validation: feed breaker vs primary FLA
    if (p.transformer && feedAmps > 0) {
      const xfKva = Number(p.transformer.kva) || 0;
      const primaryFLA = transformerFLA(xfKva, p.transformer.primaryVoltage);
      if (primaryFLA > 0 && feedAmps < Math.ceil(primaryFLA * 0.8)) {
        // Feed breaker is undersized for transformer draw — just informational
      }
      if (primaryFLA > 0 && feedAmps > 0 && feedAmps < Math.floor(primaryFLA)) {
        alignmentWarnings.push(
          `${p.panelName || 'Sub Panel'}: Feed breaker (${feedAmps}A) may be undersized for transformer primary FLA (${primaryFLA.toFixed(1)}A).`
        );
      }
    }
  }

  // Transformer warnings
  const transformerWarnings: string[] = [];
  for (const ps of panelSummaries) {
    if (ps.xfOverloaded) {
      transformerWarnings.push(
        `${ps.panel.panelName || 'Panel'}: Total load (${ps.totalOnPanel}A) exceeds transformer secondary capacity (${ps.xfSecondaryFLA.toFixed(1)}A from ${ps.xfKva}kVA).`
      );
    }
  }

  // NEC 625.40 – EV charger 125% breaker sizing warnings
  const evBreakerWarnings: string[] = [];
  for (const b of allEvBreakers) {
    const cAmps = Number(b.chargerAmps) || 0;
    const bAmps = Number(b.amps) || 0;
    if (cAmps > 0 && bAmps > 0) {
      const minAmps = minBreakerAmpsForEv(cAmps);
      if (bAmps < minAmps) {
        const suggested = nextBreakerSize(minAmps);
        const panelForBreaker = data.panels.find((p) => p.breakers.some((br) => br.id === b.id));
        evBreakerWarnings.push(
          `${b.label || 'EV Charger'}${panelForBreaker ? ` (${panelForBreaker.panelName || 'Panel'})` : ''}: Breaker ${bAmps}A < 125% of ${cAmps}A charger (need ${'\u2265'} ${minAmps}A, use ${suggested}A).`
        );
      }
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
            {panelSummaries.map((ps, i) => {
              const effV = getEffectivePanelVoltage(ps.panel, data.panels, serviceVoltage);
              const voltageNote = ps.hasTransformer ? ` [${effV}]` : '';
              return (
                <div key={ps.panel.id} className={`calc-row sub ${ps.overloaded || ps.xfOverloaded ? 'warning' : ''}`}>
                  <span>
                    {ps.panel.panelName || `Panel ${i + 1}`}
                    {voltageNote}
                    {ps.hasTransformer && ps.xfKva > 0 && (
                      <span className="calc-panel-tag"> ({ps.xfKva}kVA xfmr)</span>
                    )}
                  </span>
                  <span>{ps.loadAmps}A{ps.subFeedAmps > 0 ? ` + ${ps.subFeedAmps}A feeds` : ''}</span>
                </div>
              );
            })}
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
                const panelForBreaker = data.panels.find((p) => p.breakers.some((br) => br.id === b.id));
                const effVoltage = panelForBreaker
                  ? getEffectivePanelVoltage(panelForBreaker, data.panels, serviceVoltage)
                  : serviceVoltage;
                const v = chargerVoltage(b.chargerLevel || '', effVoltage);
                const kw = calcKw(String(v), b.chargerAmps || '');
                const panelName = panelForBreaker?.panelName || '';
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

        {(alignmentWarnings.length > 0 || transformerWarnings.length > 0 || evBreakerWarnings.length > 0) && (
          <>
            <hr />
            {alignmentWarnings.map((w, i) => (
              <div key={`align-${i}`} className="calc-alert warning">
                {w}
              </div>
            ))}
            {transformerWarnings.map((w, i) => (
              <div key={`xfmr-${i}`} className="calc-alert warning">
                {w}
              </div>
            ))}
            {evBreakerWarnings.map((w, i) => (
              <div key={`ev125-${i}`} className="calc-alert warning">
                NEC 625.40: {w}
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
