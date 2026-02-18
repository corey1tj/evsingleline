# Technical Documentation

## EV Single Line - Architecture & Developer Guide

**Version:** 1.0
**Last Updated:** 2026-02-18

---

## 1. Project Structure

```
evsingleline/
├── docs/
│   ├── PRD.md                    # Product requirements document
│   └── TECHNICAL.md              # This file
├── public/                       # Static assets
├── src/
│   ├── types.ts                  # Data model, interfaces, helper functions
│   ├── App.tsx                   # Root component, state management, CRUD
│   ├── App.css                   # Global styles
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Base/reset styles
│   └── components/
│       ├── SiteInfoForm.tsx      # Site information form
│       ├── ServiceEntranceForm.tsx # Service entrance form
│       ├── PanelHierarchy.tsx    # Panel + breaker management UI
│       ├── LoadCalculation.tsx   # Load calculation summary display
│       ├── SingleLineDiagram.tsx  # SVG single-line diagram renderer
│       ├── ExportButton.tsx      # Text/JSON export + export button group
│       └── PdfExportButton.tsx   # PDF report generation
├── index.html                    # HTML shell
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
├── eslint.config.js              # ESLint config
├── netlify.toml                  # Netlify deployment config
└── package.json                  # Dependencies and scripts
```

## 2. Data Model

### 2.1 Core Types (`src/types.ts`)

#### `SingleLineData` (Root)
The entire application state is a single JSON-serializable object:

```typescript
interface SingleLineData {
  siteInfo: SiteInfo;
  serviceEntrance: ServiceEntrance;
  panels: MainPanel[];       // Flat array; hierarchy via parentPanelId
  evChargers: EVChargerInfo[]; // Legacy; migrated into panel breakers
}
```

#### `MainPanel`
Panels form a tree via `parentPanelId` references within a flat array:

```typescript
interface MainPanel {
  id: string;
  panelName: string;
  panelLocation: string;
  panelMake: string;
  panelModel: string;
  mainBreakerAmps: string;
  busRatingAmps: string;
  totalSpaces: string;
  spareSpaces: string;        // User-entered unused/blank spaces
  condition: Condition;       // 'existing' | 'new'
  parentPanelId?: string;     // References parent panel's id
  feedBreakerId?: string;     // References the feed breaker in parent panel
  breakers: Breaker[];
  transformer?: Transformer;  // Step-down transformer config
  panelVoltage?: string;      // Overrides inherited voltage
}
```

#### `Breaker`
All load devices (regular loads, EV chargers, sub-panel feeds) are breakers:

```typescript
interface Breaker {
  id: string;
  circuitNumber: string;
  label: string;
  amps: string;               // Breaker size (e.g., "40")
  voltage: string;            // '120' | '208' | '240' | '277' | '480'
  type: 'load' | 'subpanel' | 'evcharger';
  condition: Condition;
  loadType: LoadType;         // 'continuous' | 'noncontinuous'
  subPanelId?: string;        // For type='subpanel': links to child panel
  chargerLevel?: string;      // For type='evcharger': 'Level 1' | 'Level 2' | 'Level 3'
  chargerAmps?: string;       // Charger draw amps (not breaker amps)
  chargerPorts?: string;
  wireRunFeet?: string;
  wireSize?: string;
  conduitType?: string;
  installLocation?: string;
}
```

### 2.2 Panel Hierarchy Model

Panels are stored in a **flat array** with parent references, not nested objects. This simplifies CRUD operations and avoids deep update patterns.

```
panels[0] { id: "1", parentPanelId: undefined }   // MDP (root)
panels[1] { id: "2", parentPanelId: "1" }         // Sub Panel A
panels[2] { id: "3", parentPanelId: "1" }         // Sub Panel B
panels[3] { id: "4", parentPanelId: "2" }         // Sub-sub Panel
```

**Sub-panel creation** automatically:
1. Creates a new `MainPanel` with `parentPanelId` set
2. Creates a `Breaker` of type `'subpanel'` in the parent panel
3. Links them via `feedBreakerId` and `subPanelId`

**Sub-panel deletion** cascades:
1. Collects all descendant panel IDs recursively
2. Removes all descendant panels from the flat array
3. Removes the feed breaker from the parent panel

### 2.3 Voltage System

Each panel inherits its voltage from the service entrance unless overridden by a transformer. The function `getEffectivePanelVoltage()` walks up the parent chain:

```
Service: 277/480V
  ├── MDP (277/480V - inherited)
  │   ├── Sub Panel A (120/208V - via transformer)
  │   └── Sub Panel B (277/480V - inherited)
```

Voltage options for breakers adapt to the panel's effective voltage:
- `120/240V` → 120V (1-pole), 240V (2-pole)
- `120/208V` → 120V (1-pole), 208V (2-pole)
- `277/480V` → 277V (1-pole), 480V (2-pole)

### 2.4 Transformer Calculations

```typescript
// Full-load amps (FLA) for a transformer side
function transformerFLA(kva: number, systemVoltage: string): number {
  // 3-phase: FLA = kVA × 1000 / (V_LL × √3)
  // 1-phase: FLA = kVA × 1000 / V_LL
}
```

Step-down options from 277/480V:
- 120/208V 3-phase (via transformer)
- 120/240V 1-phase (via transformer)

## 3. State Management

### 3.1 Approach
The app uses a single `useState<SingleLineData>` hook in `App.tsx`. All state mutations go through `updateData()`, which:
1. Merges the patch into current state
2. Saves to `localStorage`
3. Triggers re-render

### 3.2 Persistence
- **Storage key**: `evsingleline_data`
- **Auto-save**: Every `updateData()` call
- **Migration**: `migrateData()` handles schema evolution for old saved data

### 3.3 Migration System

The `migrateData()` function in `App.tsx` handles backward compatibility:

| Migration | Description |
|-----------|-------------|
| `mainPanel` → `panels[]` | Single panel to multi-panel array |
| `evCharger` → `evChargers[]` | Single charger to array |
| `existingLoads[]` → `panels[0].breakers[]` | Old loads into MDP breakers |
| `evChargers[]` → `panels[].breakers[]` | Old charger array into panel breakers |
| Missing `condition` | Backfill with `'existing'` (or `'new'` for EV chargers) |
| Missing `loadType` | Backfill with `'continuous'` for EV, `'noncontinuous'` for others |
| Missing `spareSpaces` | Backfill with empty string |

## 4. Component Architecture

### 4.1 Component Tree

```
App
├── SiteInfoForm          (controlled form)
├── ServiceEntranceForm   (controlled form + condition selector)
├── PanelHierarchy[]      (recursive for sub-panels)
│   ├── Panel form fields
│   ├── Transformer section (conditional)
│   ├── Breakers table
│   │   └── BreakerRow[]  (per breaker, with EV detail expansion)
│   └── PanelHierarchy[]  (child panels - recursive)
├── LoadCalculation       (read-only computed display)
├── SingleLineDiagram     (SVG renderer)
└── ExportButton
    └── PdfExportButton
```

### 4.2 PanelHierarchy (Recursive)

This component renders a single panel and recursively renders its children. Key props:

| Prop | Purpose |
|------|---------|
| `panel` | The panel data to render |
| `allPanels` | Full panel array (for hierarchy resolution) |
| `serviceVoltage` | Root service voltage (for voltage inheritance) |
| `depth` | Nesting level (for visual indentation) |
| `onUpdatePanel` | Callback to update panel in parent state |
| `onAddBreaker` | Callback to add a breaker to this panel |
| `onAddSubPanel` | Callback to add a child sub-panel |

### 4.3 BreakerRow

Renders a single table row for a breaker. For EV chargers, it also renders an expandable detail row with charger-specific fields (level, charger amps, ports, wire info, NEC 625.40 warnings).

### 4.4 Load Categories

Breaker labels are organized into categories for the dropdown selector:

| Category | Example Loads | NEC Default Load Type |
|----------|--------------|----------------------|
| HVAC / Mechanical | RTU, AHU, Chiller, Boiler, Compressor | Non-continuous |
| Lighting | Interior, Emergency, Exterior, Parking, Signage | **Continuous** |
| Power / Receptacles | Motors, UPS, Servers, Elevators | Varies (UPS/Server = continuous) |
| Kitchen / Food Service | Commercial Oven, Walk-in Cooler/Freezer | Walk-ins = **continuous** |
| Plumbing / Fire | Fire Pump, Sump Pump, Well Pump | Non-continuous |
| Life Safety / Controls | Fire Alarm, BMS, Security, Access Control | **Continuous** |
| Residential | Dryer, Washer | Non-continuous |

The `defaultLoadType()` function in `types.ts` auto-classifies loads based on their label. Users can override this per breaker.

## 5. NEC Calculations

### 5.1 NEC Demand (NEC 210.20(A) / 215.3)

```
NEC Total Demand = (Continuous Loads × 1.25) + (Non-Continuous Loads × 1.0)
```

- Continuous loads: loads expected to run >= 3 hours (lighting, EV chargers, walk-ins, etc.)
- Non-continuous loads: intermittent loads (receptacles, kitchen equipment, etc.)

### 5.2 EV Charger Sizing (NEC 625.40)

```
Minimum Breaker Amps = Charger Amps × 1.25
Recommended Breaker = next standard size >= Minimum
```

Standard breaker sizes: 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400

### 5.3 Peak kW Demand

- **General loads**: `V × Breaker_Amps / 1000`
- **EV chargers**: `V × Charger_Amps / 1000` (uses charger output, not breaker rating)
- **Total**: Sum of general loads + EV charger output

### 5.4 Panel Space Accounting

```
Accounted Spaces = Documented Breaker Spaces + User-Entered Spare Spaces
Unaccounted = Total Panel Spaces - Accounted Spaces
```

Breaker spaces: 1-pole (120V, 277V) = 1 space, 2-pole (208V, 240V, 480V) = 2 spaces

## 6. Export System

### 6.1 PDF Report (`PdfExportButton.tsx`)

Uses **jsPDF** + **jspdf-autotable** for professional reports:

1. **Page 1**: Cover with site info, service entrance, panel details
2. **Panel sections**: Info header, transformer details (if applicable), breaker table
3. **Load summary**: Amps breakdown, NEC demand, peak kW demand
4. **Diagram page**: SVG → Canvas → PNG embedded in PDF
5. **Footer**: Customer name, date, page numbers on all pages

Breaker table columns: Ckt, Label, Breaker, Voltage, Sp, Type, kW, Load, Status, Notes

### 6.2 Text Export (`ExportButton.tsx`)

Plain-text formatted report suitable for email or printing. Includes all panel data, breaker details, NEC demand calculation, and peak kW summary.

### 6.3 JSON Export

Raw `SingleLineData` JSON for backup and data portability.

## 7. SVG Diagram (`SingleLineDiagram.tsx`)

The single-line diagram is rendered as an SVG with the following visual elements:

| Element | Visual |
|---------|--------|
| Service entrance | Gray box at top |
| Panel | Blue box (existing) or yellow dashed box (new) |
| Sub-panel | Purple-tinted box |
| Regular breaker | Blue-tinted rectangle |
| EV charger | Green-tinted rectangle with kW label |
| DCFC charger | Amber-tinted rectangle |
| New items | Dashed border + yellow fill |
| Transformer | Amber badge on panel label |

The diagram auto-calculates layout based on panel hierarchy depth and breaker count.

## 8. Styling

### 8.1 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#2563eb` / `#1e40af` | Headers, buttons, links |
| Success | `#059669` | EV charger accents, export buttons |
| Warning | `#d97706` | Caution alerts (80-100% capacity) |
| Danger | `#dc2626` | Error alerts (>100% capacity) |
| Sub-panel | `#7c3aed` | Purple accent for sub-panels |
| Transformer | `#92400e` on `#fef3c7` | Amber accent for transformers |
| New/Proposed | `#a16207` on `#fef9c3` | Yellow accent for new items |

### 8.2 Responsive

- Grid layout collapses to single column below 600px
- Table font sizes reduce for mobile
- Export buttons stack vertically on narrow screens

## 9. Build & Deploy

### 9.1 Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # Production build (tsc + vite build)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

### 9.2 Production Build

```bash
npm run build
# Output: dist/
```

### 9.3 Deployment

The app is configured for Netlify (`netlify.toml`) but can be deployed to any static hosting:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## 10. Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `jspdf` | PDF document generation |
| `jspdf-autotable` | Table rendering in PDFs |
| `typescript` | Type safety |
| `vite` | Build tool and dev server |
| `eslint` | Code linting |
