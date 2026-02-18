import type { SingleLineData, Panel } from '../types';

interface Props {
  data: SingleLineData;
}

// Layout constants
const COL_W = 180;
const ROW_H = 90;
const BOX_W = 160;
const BOX_H = 70;
const CHARGER_W = 140;
const CHARGER_H = 60;
const PAD_X = 40;
const PAD_Y = 30;

interface LayoutNode {
  id: string;
  type: 'utility' | 'service' | 'mdp' | 'panel' | 'charger';
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId?: string;
  color: string;
}

function buildLayout(data: SingleLineData): { nodes: LayoutNode[]; width: number; height: number } {
  const nodes: LayoutNode[] = [];
  let currentY = PAD_Y;

  // Utility node (top)
  const utilityX = PAD_X;
  nodes.push({
    id: 'utility',
    type: 'utility',
    label: 'UTILITY',
    sublabel: data.services.map((s) => s.utilityProvider).filter(Boolean).join(', ') || 'Power Company',
    x: utilityX,
    y: currentY,
    w: BOX_W,
    h: BOX_H,
    color: '#6366f1',
  });

  currentY += ROW_H + 10;

  let maxX = BOX_W + PAD_X * 2;

  // For each service
  for (let si = 0; si < data.services.length; si++) {
    const svc = data.services[si];
    const serviceX = PAD_X + si * (COL_W + 40);

    // Service entrance node
    nodes.push({
      id: `svc-${svc.id}`,
      type: 'service',
      label: svc.serviceName || `Service ${si + 1}`,
      sublabel: `${svc.serviceVoltage || '?'} ${svc.servicePhase === 'three' ? '3\u03A6' : svc.servicePhase === 'single' ? '1\u03A6' : ''} ${svc.serviceAmperage ? svc.serviceAmperage + 'A' : ''}`,
      x: serviceX,
      y: currentY,
      w: BOX_W,
      h: BOX_H,
      parentId: 'utility',
      color: '#0891b2',
    });

    // MDP
    const mdp = data.panels.find((p) => p.serviceId === svc.id && p.parentId === '');
    if (mdp) {
      const mdpY = currentY + ROW_H + 10;
      nodes.push({
        id: `panel-${mdp.id}`,
        type: 'mdp',
        label: mdp.panelName || 'MDP',
        sublabel: `${mdp.busVoltage || '?'}V ${mdp.mainBreakerAmps ? mdp.mainBreakerAmps + 'A' : ''}`,
        x: serviceX,
        y: mdpY,
        w: BOX_W,
        h: BOX_H,
        parentId: `svc-${svc.id}`,
        color: '#dc2626',
      });

      // Recursively layout child panels and chargers
      let panelCol = 0;
      const layoutChildren = (parentPanel: Panel, parentNodeId: string, baseX: number, baseY: number) => {
        const children = data.panels.filter((p) => p.parentId === parentPanel.id);
        const chargers = data.evChargers.filter((c) => c.panelId === parentPanel.id);

        const nextY = baseY + ROW_H + 10;

        // Chargers under this panel
        for (let ci = 0; ci < chargers.length; ci++) {
          const charger = chargers[ci];
          const cx = baseX + (panelCol) * (COL_W + 20);
          nodes.push({
            id: `charger-${charger.id}`,
            type: 'charger',
            label: charger.chargerLabel || `Charger ${ci + 1}`,
            sublabel: `${charger.chargerLevel === 'Level 3 DCFC' ? 'DCFC' : charger.chargerLevel || '?'} ${charger.chargerAmps ? charger.chargerAmps + 'A' : ''} ${charger.breakerSize ? '(' + charger.breakerSize + 'A brk)' : ''}`,
            x: cx,
            y: nextY,
            w: CHARGER_W,
            h: CHARGER_H,
            parentId: parentNodeId,
            color: charger.chargerLevel === 'Level 3 DCFC' ? '#7c3aed' : '#059669',
          });
          panelCol++;
          maxX = Math.max(maxX, cx + CHARGER_W + PAD_X);
        }

        // Child panels
        for (const child of children) {
          const cx = baseX + (panelCol) * (COL_W + 20);
          const childNodeId = `panel-${child.id}`;
          nodes.push({
            id: childNodeId,
            type: 'panel',
            label: child.panelName || 'Sub-Panel',
            sublabel: `${child.busVoltage || '?'}V ${child.mainBreakerAmps ? child.mainBreakerAmps + 'A' : ''} ${child.feedBreakerAmps ? '(fed ' + child.feedBreakerAmps + 'A)' : ''}`,
            x: cx,
            y: nextY,
            w: BOX_W,
            h: BOX_H,
            parentId: parentNodeId,
            color: '#d97706',
          });
          panelCol++;
          maxX = Math.max(maxX, cx + BOX_W + PAD_X);

          // Recurse
          layoutChildren(child, childNodeId, cx, nextY);
        }
      };

      layoutChildren(mdp, `panel-${mdp.id}`, serviceX, mdpY);
    }
  }

  // Calculate total height
  let maxY = 0;
  for (const n of nodes) {
    maxY = Math.max(maxY, n.y + n.h);
  }

  return { nodes, width: Math.max(maxX, BOX_W + PAD_X * 2), height: maxY + PAD_Y };
}

function SvgBox({ node }: { node: LayoutNode }) {
  const isCharger = node.type === 'charger';
  const rx = isCharger ? 8 : 4;

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={rx}
        fill="white"
        stroke={node.color}
        strokeWidth={node.type === 'mdp' || node.type === 'service' ? 2.5 : 1.5}
      />
      {/* Type indicator line at top */}
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={4}
        rx={rx}
        fill={node.color}
      />
      <text
        x={node.x + node.w / 2}
        y={node.y + 24}
        textAnchor="middle"
        fontSize={node.type === 'charger' ? 11 : 12}
        fontWeight="600"
        fill="#1e293b"
      >
        {node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label}
      </text>
      <text
        x={node.x + node.w / 2}
        y={node.y + 42}
        textAnchor="middle"
        fontSize={10}
        fill="#64748b"
      >
        {node.sublabel.length > 26 ? node.sublabel.slice(0, 24) + '...' : node.sublabel}
      </text>
      {/* Breaker symbol for service and panel nodes */}
      {(node.type === 'service' || node.type === 'mdp' || node.type === 'panel') && (
        <>
          {/* Small breaker symbol (X) at top connection point */}
          <line x1={node.x + node.w / 2 - 4} y1={node.y - 6} x2={node.x + node.w / 2 + 4} y2={node.y + 2} stroke={node.color} strokeWidth={1.5} />
          <line x1={node.x + node.w / 2 + 4} y1={node.y - 6} x2={node.x + node.w / 2 - 4} y2={node.y + 2} stroke={node.color} strokeWidth={1.5} />
        </>
      )}
    </g>
  );
}

function SvgConnector({ parent, child }: { parent: LayoutNode; child: LayoutNode }) {
  const x1 = parent.x + parent.w / 2;
  const y1 = parent.y + parent.h;
  const x2 = child.x + child.w / 2;
  const y2 = child.y - 8;

  // Draw a path: down from parent, then horizontal, then down to child
  const midY = (y1 + y2) / 2;

  return (
    <path
      d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={1.5}
      strokeDasharray={child.type === 'charger' ? '4 2' : 'none'}
    />
  );
}

export function SingleLineDiagram({ data }: Props) {
  if (data.services.length === 0) return <p>Add a service to generate a diagram.</p>;

  const { nodes, width, height } = buildLayout(data);

  // Build a map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="diagram-container svg-diagram">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, minHeight: 200 }}
      >
        {/* Background */}
        <rect width={width} height={height} fill="#f8fafc" rx={8} />

        {/* Connectors (draw first, behind boxes) */}
        {nodes.filter((n) => n.parentId).map((n) => {
          const parent = nodeMap.get(n.parentId!);
          if (!parent) return null;
          return <SvgConnector key={`conn-${n.id}`} parent={parent} child={n} />;
        })}

        {/* Nodes */}
        {nodes.map((n) => (
          <SvgBox key={n.id} node={n} />
        ))}

        {/* Legend */}
        <g transform={`translate(${width - 170}, ${height - 90})`}>
          <rect x={0} y={0} width={160} height={80} rx={4} fill="white" stroke="#e2e8f0" />
          <text x={8} y={16} fontSize={9} fontWeight="600" fill="#475569">LEGEND</text>
          <rect x={8} y={22} width={12} height={8} fill="#6366f1" rx={2} />
          <text x={24} y={30} fontSize={9} fill="#64748b">Utility</text>
          <rect x={8} y={34} width={12} height={8} fill="#0891b2" rx={2} />
          <text x={24} y={42} fontSize={9} fill="#64748b">Service</text>
          <rect x={80} y={22} width={12} height={8} fill="#dc2626" rx={2} />
          <text x={96} y={30} fontSize={9} fill="#64748b">MDP</text>
          <rect x={80} y={34} width={12} height={8} fill="#d97706" rx={2} />
          <text x={96} y={42} fontSize={9} fill="#64748b">Sub-Panel</text>
          <rect x={8} y={46} width={12} height={8} fill="#059669" rx={2} />
          <text x={24} y={54} fontSize={9} fill="#64748b">L1/L2 Charger</text>
          <rect x={8} y={58} width={12} height={8} fill="#7c3aed" rx={2} />
          <text x={24} y={66} fontSize={9} fill="#64748b">L3 DCFC</text>
        </g>
      </svg>
    </div>
  );
}
