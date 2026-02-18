# Product Requirements Document (PRD)

## EV Single Line - Electrical One-Line Survey Tool

**Version:** 1.0
**Last Updated:** 2026-02-18

---

## 1. Overview

EV Single Line is a browser-based tool for capturing electrical one-line information during EV charger installation site surveys. It enables field technicians and electrical engineers to document existing electrical infrastructure, plan new EV charger installations, and generate professional reports -- all from a single-page application that stores data locally in the browser.

## 2. Problem Statement

EV charger installation projects require detailed electrical surveys to assess panel capacity, breaker availability, and code compliance. Today, this process relies on paper forms, spreadsheets, or generic note-taking tools that:

- Lack built-in NEC code validation
- Require manual calculation of load demands and panel capacity
- Do not produce professional client-ready reports
- Cannot model panel hierarchies (MDP -> sub-panels -> sub-sub-panels)
- Provide no visual single-line diagram output

## 3. Target Users

| User | Use Case |
|------|----------|
| **Field Technicians** | Capture site survey data on-site using a tablet or laptop |
| **Electrical Engineers** | Review and validate survey data, verify NEC compliance |
| **Project Managers** | Generate reports for clients and permitting authorities |
| **Sales Engineers** | Assess feasibility and produce proposals for EV charger installations |

## 4. Core Features

### 4.1 Site Information Capture
- Customer name, address, city/state/ZIP
- Survey date and technician name
- Free-form notes field

### 4.2 Service Entrance Documentation
- Utility provider, meter number
- Service voltage (120/240V, 120/208V, 277/480V)
- Service phase (single or three-phase)
- Service amperage
- Existing vs. new/proposed status

### 4.3 Panel Hierarchy Management
- **Main Distribution Panel (MDP)**: Root panel with make, model, main breaker, bus rating, total spaces
- **Sub-panels**: Nested under any panel with automatic feed breaker creation
- **Unlimited depth**: Sub-panels can have their own sub-panels
- **Transformer support**: Sub-panels can be fed via step-down transformers (e.g., 480V -> 208V)
  - Automatic FLA calculation for primary and secondary sides
  - Standard kVA size selection or custom entry
- **Existing vs. New**: Each panel tracks whether it is existing infrastructure or new/proposed
- **Spare spaces tracking**: User-entered unused/spare space count for complete panel accounting

### 4.4 Breaker Management
- **Circuit number**: Supports 2-pole breakers with dual circuit numbers (e.g., "1,3")
- **Common load labels**: Organized by category with commercial and residential options
  - HVAC / Mechanical (RTU, AHU, Chiller, Boiler, Compressor, etc.)
  - Lighting (Interior, Emergency, Exterior, Parking, Signage)
  - Power / Receptacles (Motors, Welding, UPS, Servers, Elevators, etc.)
  - Kitchen / Food Service (Commercial Ovens, Walk-ins, Ice Machines, etc.)
  - Plumbing / Fire (Pumps, Fire Pump, Jockey Pump, etc.)
  - Life Safety / Controls (Fire Alarm, BMS, Security, Access Control, etc.)
  - Residential (Dryer, Washer, etc.)
  - Custom "Other" with free-text entry
- **Standard breaker sizes**: 15A through 400A per NEC standard sizes
- **Voltage selection**: Automatically adapts to panel's voltage system
- **Automatic space calculation**: 1-pole (120V, 277V) = 1 space, 2-pole (208V, 240V, 480V) = 2 spaces
- **Existing vs. New status**: Track which breakers are existing vs. proposed
- **NEC load classification**: Continuous vs. non-continuous per NEC 210.2
- **Peak kW display**: Per-breaker kW shown in the breaker table

### 4.5 EV Charger Configuration
- **Charger levels**: Level 1 (120V), Level 2 (208V/240V), Level 3 DCFC (480V)
- **Automatic voltage**: Voltage auto-sets based on charger level and panel infrastructure
- **Charger amps**: Separate input for charger draw amps (distinct from breaker amps)
- **Number of ports**: Multi-port charger support
- **kW output calculation**: Automatic `V x chargerAmps / 1000`
- **Wire run details**: Length, wire size (12 AWG - 2/0 AWG), conduit type
- **Install location**: Free-text description
- **NEC 625.40 enforcement**: Breaker must be >= 125% of charger amps (continuous load)
  - Automatic minimum breaker calculation
  - Warning when breaker is undersized
  - Suggested standard breaker size

### 4.6 Load Calculation Summary
- **Service/MDP rating**: Derived from service amps and main breaker
- **Per-panel breakdown**: Load amps, sub-panel feed amps, transformer info
- **Existing vs. New load split**: Separate totals for existing and proposed loads
- **Capacity utilization**: Percentage with color-coded warnings (green/amber/red)
- **NEC demand calculation**:
  - Continuous loads x 1.25 (per NEC 210.20(A) / 215.3)
  - Non-continuous loads x 1.0
  - Total NEC demand with service rating comparison
- **Peak kW demand**:
  - General loads: breaker rating kW (V x A / 1000)
  - EV chargers: charger output kW (V x chargerAmps / 1000)
  - Per-panel and total summaries
- **Panel space summary**: Accounted spaces (breakers + spare) vs. total
- **Validation warnings**:
  - Panel overload (load > main breaker)
  - Transformer overload (load > secondary FLA)
  - Sub-panel feed alignment (main breaker > feed breaker)
  - NEC 625.40 breaker sizing violations
  - Unaccounted panel spaces

### 4.7 Single-Line Diagram (SVG)
- Auto-generated from survey data
- Service entrance -> MDP -> sub-panels hierarchy
- Color-coded breaker types (load, EV, DCFC, sub-panel)
- Visual distinction for new items (dashed borders, yellow fill)
- Transformer symbols with kVA and voltage labels
- kW annotations on EV chargers
- Port count display on chargers
- Download as PNG

### 4.8 Export Capabilities
- **PDF Report**: Professional multi-page report with:
  - Cover page with site info and service entrance details
  - Panel details with breaker tables (Ckt, Label, Breaker, Voltage, Sp, Type, kW, Load, Status)
  - Load calculation summary with NEC demand and peak kW
  - Single-line diagram image
  - Page numbers and footer branding
- **Text Export**: Plain-text summary of all survey data
- **JSON Export**: Full data export for backup/import

## 5. NEC Code Compliance

| NEC Section | Feature |
|-------------|---------|
| **NEC 210.2** | Continuous load definition (>= 3 hours) |
| **NEC 210.20(A)** | Overcurrent device rating for continuous loads (125%) |
| **NEC 215.3** | Feeder overcurrent protection for continuous loads |
| **NEC 625.40** | EV charger as continuous load, breaker >= 125% of charger amps |
| **NEC 408** | Panelboard space accounting |

## 6. Technical Requirements

### 6.1 Architecture
- **Framework**: React 18+ with TypeScript
- **Build**: Vite
- **Styling**: Plain CSS (no framework dependency)
- **Storage**: localStorage (browser-only, no server required)
- **PDF Generation**: jsPDF + jspdf-autotable
- **Diagram**: SVG rendered in React, exportable as PNG via canvas

### 6.2 Deployment
- Static site deployment (Netlify, Vercel, or any static host)
- No backend or database required
- Works offline after initial page load

### 6.3 Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive layout for tablets (min 600px recommended)

### 6.4 Data Model
- All data stored as a single `SingleLineData` JSON object
- Backward-compatible migration system for schema changes
- Auto-save on every change via localStorage

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Page Load** | < 2 seconds on broadband |
| **Data Persistence** | Survives browser refresh, cleared only on explicit action |
| **Accessibility** | Standard form controls, keyboard navigable |
| **Portability** | Data exportable as JSON for backup/transfer |

## 8. Future Considerations

- Cloud sync / multi-device support
- Photo attachment capability
- NEC load schedule calculations (Article 220)
- Demand factor application for large commercial services
- Multi-service entrance support
- AHJ-specific code requirement overlays
- Import from existing electrical drawings (PDF parsing)
- Integration with EV charger manufacturer databases for auto-configuration
