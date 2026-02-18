import { useRef, type ReactNode } from 'react';
import type { SingleLineData, MainPanel } from '../types';
import { calcKw, chargerVoltage } from '../types';

interface Props {
  data: SingleLineData;
}

// Layout constants
const COL_WIDTH = 140;
const PANEL_BOX_W = 120;
const PANEL_BOX_H = 40;
const BREAKER_W = 100;
const BREAKER_H = 28;
const LINE_COLOR = '#334155';
const PANEL_FILL = '#dbeafe';
const PANEL_STROKE = '#2563eb';
const SUBPANEL_FILL = '#ede9fe';
const SUBPANEL_STROKE = '#7c3aed';
const EV_FILL = '#d1fae5';
const EV_STROKE = '#059669';
const LOAD_FILL = '#f1f5f9';
const LOAD_STROKE = '#94a3b8';
const FONT = '11px system-ui, sans-serif';
const FONT_SMALL = '9px system-ui, sans-serif';
const FONT_LABEL = '10px system-ui, sans-serif';

/** Measure total width needed for a panel and its descendant tree */
function measurePanelWidth(panel: MainPanel, allPanels: MainPanel[]): number {
  const childPanels = allPanels.filter((p) => p.parentPanelId === panel.id);
  const nonSubBreakers = panel.breakers.filter((b) => b.type !== 'subpanel');

  // Count leaf columns: each non-sub breaker = 1 column, each sub-panel = its own width
  const breakerCols = nonSubBreakers.length;
  const childWidths = childPanels.map((c) => measurePanelWidth(c, allPanels));
  const childTotal = childWidths.reduce((s, w) => s + w, 0);

  const totalCols = Math.max(1, breakerCols + (childTotal / COL_WIDTH));
  return totalCols * COL_WIDTH;
}

export function SingleLineDiagram({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const sv = data.serviceEntrance;
  const serviceVoltage = sv.serviceVoltage;
  const rootPanels = data.panels.filter((p) => !p.parentPanelId);

  if (rootPanels.length === 0) return null;

  // Calculate total width needed
  const totalTreeWidth = rootPanels.reduce(
    (s, p) => s + measurePanelWidth(p, data.panels),
    0
  );
  const svgWidth = Math.max(500, totalTreeWidth + 80);

  // Collect all SVG elements
  const elements: ReactNode[] = [];
  let maxY = 0;

  // -- Utility source (top) --
  const cx = svgWidth / 2;
  let y = 30;

  // Utility symbol: circle with ~ (AC source)
  elements.push(
    <g key="utility">
      <circle cx={cx} cy={y} r={18} fill="none" stroke={LINE_COLOR} strokeWidth={2} />
      <text x={cx} y={y + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill={LINE_COLOR}>~</text>
      <text x={cx} y={y - 24} textAnchor="middle" fontSize="10" fill="#64748b">
        {sv.utilityProvider || 'Utility'}
      </text>
    </g>
  );
  y += 18;

  // Vertical line down from utility
  const lineToMeter = y + 30;
  elements.push(
    <line key="line-util-meter" x1={cx} y1={y} x2={cx} y2={lineToMeter} stroke={LINE_COLOR} strokeWidth={2} />
  );
  y = lineToMeter;

  // -- Meter --
  elements.push(
    <g key="meter">
      <rect x={cx - 20} y={y - 14} width={40} height={28} rx={4} fill="#fff" stroke={LINE_COLOR} strokeWidth={1.5} />
      <text x={cx} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={LINE_COLOR}>M</text>
      {sv.meterNumber && (
        <text x={cx + 26} y={y + 4} fontSize="9" fill="#94a3b8">#{sv.meterNumber}</text>
      )}
    </g>
  );
  y += 14;

  // Line to service entrance info
  const lineToService = y + 25;
  elements.push(
    <line key="line-meter-svc" x1={cx} y1={y} x2={cx} y2={lineToService} stroke={LINE_COLOR} strokeWidth={2} />
  );
  y = lineToService;

  // -- Service entrance label --
  const serviceLabel = [
    sv.serviceVoltage,
    sv.servicePhase === 'three' ? '3\u03C6' : sv.servicePhase === 'single' ? '1\u03C6' : '',
    sv.serviceAmperage ? `${sv.serviceAmperage}A` : '',
  ].filter(Boolean).join(' / ');

  if (serviceLabel) {
    elements.push(
      <text key="svc-label" x={cx + 6} y={y - 8} fontSize="9" fill="#64748b">{serviceLabel}</text>
    );
  }

  // -- Main breaker symbol (disconnect) --
  const mbY = y;
  elements.push(
    <g key="main-breaker">
      <line x1={cx} y1={mbY} x2={cx} y2={mbY + 6} stroke={LINE_COLOR} strokeWidth={2} />
      <line x1={cx - 6} y1={mbY + 6} x2={cx + 6} y2={mbY + 6} stroke={LINE_COLOR} strokeWidth={2.5} />
      <line x1={cx - 6} y1={mbY + 12} x2={cx + 6} y2={mbY + 12} stroke={LINE_COLOR} strokeWidth={2.5} />
      <line x1={cx} y1={mbY + 12} x2={cx} y2={mbY + 20} stroke={LINE_COLOR} strokeWidth={2} />
    </g>
  );
  y = mbY + 20;

  // -- Render panels recursively --
  function renderPanel(panel: MainPanel, panelCx: number, startY: number, isSubPanel: boolean): number {
    let curY = startY;

    // Panel box
    const boxX = panelCx - PANEL_BOX_W / 2;
    const fill = isSubPanel ? SUBPANEL_FILL : PANEL_FILL;
    const stroke = isSubPanel ? SUBPANEL_STROKE : PANEL_STROKE;

    elements.push(
      <g key={`panel-${panel.id}`}>
        <rect x={boxX} y={curY} width={PANEL_BOX_W} height={PANEL_BOX_H} rx={4}
          fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text x={panelCx} y={curY + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e293b">
          {(panel.panelName || 'Panel').substring(0, 16)}
        </text>
        <text x={panelCx} y={curY + 30} textAnchor="middle" fontSize="9" fill="#64748b">
          {[panel.mainBreakerAmps ? `${panel.mainBreakerAmps}A` : '', panel.totalSpaces ? `${panel.totalSpaces}sp` : ''].filter(Boolean).join(' / ')}
        </text>
      </g>
    );

    curY += PANEL_BOX_H;

    // Calculate columns
    const allCols: Array<{ kind: 'breaker'; b: typeof panel.breakers[0] } | { kind: 'subpanel'; p: MainPanel; width: number }> = [];

    for (const b of panel.breakers) {
      if (b.type === 'subpanel') {
        const childPanel = data.panels.find((p) => p.id === b.subPanelId);
        if (childPanel) {
          allCols.push({ kind: 'subpanel', p: childPanel, width: measurePanelWidth(childPanel, data.panels) });
        }
      } else {
        allCols.push({ kind: 'breaker', b });
      }
    }

    if (allCols.length === 0) {
      if (curY > maxY) maxY = curY;
      return curY;
    }

    // Total width of all columns
    const totalWidth = allCols.reduce((s, col) => {
      if (col.kind === 'breaker') return s + COL_WIDTH;
      return s + Math.max(COL_WIDTH, col.width);
    }, 0);

    // Bus bar line
    const busY = curY + 10;
    const busStartX = panelCx - totalWidth / 2;
    const busEndX = panelCx + totalWidth / 2;

    // Vertical line from panel to bus
    elements.push(
      <line key={`bus-vert-${panel.id}`} x1={panelCx} y1={curY} x2={panelCx} y2={busY}
        stroke={LINE_COLOR} strokeWidth={2} />
    );
    // Horizontal bus bar
    if (allCols.length > 1) {
      elements.push(
        <line key={`bus-${panel.id}`} x1={busStartX + COL_WIDTH / 2} y1={busY} x2={busEndX - COL_WIDTH / 2 + (allCols[allCols.length - 1].kind === 'subpanel' ? (allCols[allCols.length - 1] as any).width / 2 - COL_WIDTH / 2 : 0)} y2={busY}
          stroke={LINE_COLOR} strokeWidth={2} />
      );
    }

    // Layout each column
    let colX = busStartX;
    const breakerY = busY + 20;

    for (let i = 0; i < allCols.length; i++) {
      const col = allCols[i];
      if (col.kind === 'breaker') {
        const bCx = colX + COL_WIDTH / 2;

        // Drop line from bus to breaker
        elements.push(
          <line key={`drop-${col.b.id}`} x1={bCx} y1={busY} x2={bCx} y2={breakerY}
            stroke={LINE_COLOR} strokeWidth={1.5} />
        );

        // Breaker box
        const isEv = col.b.type === 'evcharger';
        const bFill = isEv ? EV_FILL : LOAD_FILL;
        const bStroke = isEv ? EV_STROKE : LOAD_STROKE;

        elements.push(
          <g key={`breaker-${col.b.id}`}>
            <rect x={bCx - BREAKER_W / 2} y={breakerY} width={BREAKER_W} height={BREAKER_H} rx={3}
              fill={bFill} stroke={bStroke} strokeWidth={1} />
            <text x={bCx} y={breakerY + 12} textAnchor="middle" style={{ font: FONT_SMALL }} fill="#1e293b">
              {(col.b.label || 'Load').substring(0, 14)}
            </text>
            <text x={bCx} y={breakerY + 23} textAnchor="middle" style={{ font: FONT_SMALL }} fill="#64748b">
              {col.b.amps ? `${col.b.amps}A` : ''}
              {col.b.circuitNumber ? ` Ckt${col.b.circuitNumber}` : ''}
            </text>
          </g>
        );

        // EV charger symbol below
        if (isEv) {
          const evY = breakerY + BREAKER_H + 8;
          elements.push(
            <line key={`ev-line-${col.b.id}`} x1={bCx} y1={breakerY + BREAKER_H} x2={bCx} y2={evY}
              stroke={EV_STROKE} strokeWidth={1} />
          );

          const v = chargerVoltage(col.b.chargerLevel || '', serviceVoltage);
          const kw = calcKw(String(v), col.b.chargerAmps || '');

          elements.push(
            <g key={`ev-sym-${col.b.id}`}>
              <rect x={bCx - 16} y={evY} width={32} height={20} rx={4}
                fill={EV_FILL} stroke={EV_STROKE} strokeWidth={1.5} />
              <text x={bCx} y={evY + 13} textAnchor="middle" fontSize="9" fontWeight="bold" fill={EV_STROKE}>EV</text>
              {kw > 0 && (
                <text x={bCx} y={evY + 32} textAnchor="middle" style={{ font: FONT_LABEL }} fill="#047857">
                  {kw.toFixed(1)}kW
                </text>
              )}
            </g>
          );

          const endY = evY + 38;
          if (endY > maxY) maxY = endY;
        } else {
          const endY = breakerY + BREAKER_H + 8;
          if (endY > maxY) maxY = endY;
        }

        colX += COL_WIDTH;
      } else {
        // Sub-panel column
        const colW = Math.max(COL_WIDTH, col.width);
        const spCx = colX + colW / 2;

        // Drop line from bus to sub-panel
        elements.push(
          <line key={`drop-sub-${col.p.id}`} x1={spCx} y1={busY} x2={spCx} y2={breakerY}
            stroke={LINE_COLOR} strokeWidth={1.5} />
        );

        // Sub-panel breaker symbol (the feed breaker)
        const feedBreaker = panel.breakers.find((b) => b.subPanelId === col.p.id);
        if (feedBreaker) {
          // Small breaker symbol
          elements.push(
            <g key={`feed-bkr-${feedBreaker.id}`}>
              <line x1={spCx - 5} y1={breakerY} x2={spCx + 5} y2={breakerY} stroke={SUBPANEL_STROKE} strokeWidth={2} />
              <line x1={spCx - 5} y1={breakerY + 4} x2={spCx + 5} y2={breakerY + 4} stroke={SUBPANEL_STROKE} strokeWidth={2} />
              {feedBreaker.amps && (
                <text x={spCx + 10} y={breakerY + 6} style={{ font: FONT_SMALL }} fill="#7c3aed">
                  {feedBreaker.amps}A
                </text>
              )}
            </g>
          );
        }

        // Line from feed breaker to sub-panel
        const subPanelY = breakerY + 16;
        elements.push(
          <line key={`line-to-sub-${col.p.id}`} x1={spCx} y1={breakerY + 4} x2={spCx} y2={subPanelY}
            stroke={LINE_COLOR} strokeWidth={1.5} />
        );

        // Recursively render sub-panel
        const deepestY = renderPanel(col.p, spCx, subPanelY, true);
        if (deepestY > maxY) maxY = deepestY;

        colX += colW;
      }
    }

    return maxY;
  }

  // Render root panels
  let rootX = (svgWidth - totalTreeWidth) / 2;
  for (const rootPanel of rootPanels) {
    const panelWidth = measurePanelWidth(rootPanel, data.panels);
    const panelCx = rootX + panelWidth / 2;

    // Line from main breaker to panel
    const panelStartY = y + 10;
    elements.push(
      <line key={`line-to-panel-${rootPanel.id}`} x1={cx} y1={y} x2={panelCx} y2={panelStartY}
        stroke={LINE_COLOR} strokeWidth={2} />
    );

    renderPanel(rootPanel, panelCx, panelStartY, false);
    rootX += panelWidth;
  }

  const svgHeight = maxY + 40;

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = data.siteInfo.customerName || 'diagram';
    a.download = `${name.replace(/\s+/g, '_')}_single_line.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Single Line Diagram</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;padding:1rem}svg{max-width:100%;height:auto}@media print{body{padding:0}}</style>
      </head>
      <body>${svgData}</body>
      </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  return (
    <fieldset className="diagram-section">
      <legend>Single Line Diagram</legend>
      <div className="diagram-toolbar">
        <button type="button" className="btn-export btn-small" onClick={handleExportSvg}>
          Export SVG
        </button>
        <button type="button" className="btn-export btn-small" onClick={handlePrint}>
          Print
        </button>
      </div>
      <div className="diagram-container">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ font: FONT, background: '#fff' }}
        >
          {elements}
        </svg>
      </div>
    </fieldset>
  );
}
