# Hermes Mission Control — Milestone MC-4: Pixel Office Architecture

## 1. Executive Summary & Purpose

Milestone **HERMES-MC-4** introduces the **RancangLoka 2D Pixel Office** (`/admin/mission-control/office`).

Unlike game simulations or virtual world sandboxes, the RancangLoka Pixel Office is a **100% deterministic spatial telemetry visualizer**. Every avatar placement, room occupancy, status badge, warning beacon, and visual mode directly maps from active telemetry in Cloudflare D1.

### Core Principles & Invariants:
1. **Zero Fake Activity / No Random Wandering:** Characters never wander aimlessly or simulate synthetic chatter. Every position is anchored by deterministic state.
2. **Read-Only Supervisory Layer:** Zero commands, zero direct chats, zero retry buttons, zero publication triggers.
3. **Intentional vs Unexpected Downtime Disambiguation:** Subsystems intentionally disabled by operator policy (e.g. `media_worker = DISABLED`) are visually dimmed with neutral `Worker Disabled` tags—never colored as emergency critical failures.
4. **Stable Non-Overlapping Coordinates:** Dedicated workstation desks and indexed Lounge waiting seats ensure staff never overlap.
5. **Future Capacity Unstaffed:** The `social_room` is displayed as `COMING LATER / NOT AVAILABLE` with zero personas.
6. **Ultra-Lightweight & Accessible:** Free of heavy game engines (Phaser/Unity-free), crisp CSS pixel rendering (`image-rendering: pixelated;`), responsive layout, and full `@media (prefers-reduced-motion: reduce)` support.

---

## 2. Floor Plan & Room Registry

The Pixel Office models RancangLoka as a cohesive modern digital newsroom and engineering bureau.

| Room Key | Title | Zone Description | Home Staff | Workstation Key |
|---|---|---|---|---|
| `editorial_room` | Editorial Room | Zone E - Writing & Editorial QA | Joko, Rina | `editorial_writer_desk`, `editorial_review_desk` |
| `research_lab` | Research & Evidence Lab | Zone R - Fact Checking & Reference Lab | Irwan | `research_main_desk` |
| `media_room` | Media Operations | Zone M - Visual Processing Queue | Budi | `media_console` |
| `publication_room` | Publication Operations | Zone P - Dispatch Console & Safety Gates | Sari | `publication_console` |
| `operations_room` | Engineering & Telemetry | Zone O - Telemetry Monolith & Decision Console | Dimas | `operations_console` |
| `lounge` | Executive Lounge | Zone L - Neutral Standby Lounge | Dynamic (All Idle Staff) | `lounge_seat_1` .. `lounge_seat_6` |
| `social_room` | Social & Distribution | Zone S - Unstaffed Distribution Bay | *None* | `social_bay_empty` |

---

## 3. Position Registry (`OFFICE_POSITIONS`)

Positions are defined deterministically as percentage coordinates `(x, y)` inside each room card:

```typescript
export const OFFICE_POSITIONS: OfficePosition[] = [
  // Editorial
  { position_key: 'editorial_writer_desk', room_key: 'editorial_room', label: 'Meja Penulisan Joko', x: 30, y: 55 },
  { position_key: 'editorial_review_desk', room_key: 'editorial_room', label: 'Meja Review Rina', x: 70, y: 55 },
  // Research
  { position_key: 'research_main_desk', room_key: 'research_lab', label: 'Konsol Riset Irwan', x: 50, y: 55 },
  // Media
  { position_key: 'media_console', room_key: 'media_room', label: 'Konsol Media Budi', x: 50, y: 55 },
  // Publication
  { position_key: 'publication_console', room_key: 'publication_room', label: 'Konsol Dispatch Sari', x: 50, y: 55 },
  // Operations
  { position_key: 'operations_console', room_key: 'operations_room', label: 'Konsol Telemetri Dimas', x: 50, y: 55 },
  // Lounge Seats
  { position_key: 'lounge_seat_1', room_key: 'lounge', label: 'Sofa Santai 1', x: 18, y: 40 },
  { position_key: 'lounge_seat_2', room_key: 'lounge', label: 'Sofa Santai 2', x: 34, y: 40 },
  { position_key: 'lounge_seat_3', room_key: 'lounge', label: 'Sofa Santai 3', x: 50, y: 40 },
  { position_key: 'lounge_seat_4', room_key: 'lounge', label: 'Sofa Santai 4', x: 66, y: 40 },
  { position_key: 'lounge_seat_5', room_key: 'lounge', label: 'Meja Kopi Timur', x: 30, y: 75 },
  { position_key: 'lounge_seat_6', room_key: 'lounge', label: 'Meja Kopi Barat', x: 70, y: 75 },
  // Social (Unstaffed)
  { position_key: 'social_bay_empty', room_key: 'social_room', label: 'Area Distribusi Kosong', x: 50, y: 50 }
];
```

---

## 4. State → Spatial Mapping Rules

Every staff sprite has their room and position determined by `deriveSpriteSpatialState()`:

1. **`WORKING`:**
   - Placed at home department workstation desk.
   - Visual mode: `ACTIVE`.
   - Green pulsing status badge.
2. **`REVIEWING`:**
   - Rina is placed at `editorial_review_desk`. Other staff retain their desk with indigo `REVIEWING` indicator.
   - Visual mode: `REVIEWING`.
   - Indigo status badge.
3. **`IDLE`:**
   - Moved to `lounge`.
   - Assigned deterministic seat index (`lounge_seat_${(index % 6) + 1}`).
   - Visual mode: `IDLE`.
   - Slate standby badge.
4. **`BLOCKED`:**
   - Stays at home department workstation.
   - Visual mode: `BLOCKED`.
   - Warning level: `CRITICAL`.
   - Red pulsing alert beacon.
5. **`OFFLINE`:**
   - If intentional (e.g. Media worker disabled by setting): Visual mode `DIMMED`, Warning level `NONE`, Badge `Worker Disabled`. No red emergency beacon.
   - If telemetry failure (e.g. Hermes daemon heartbeat missing): Visual mode `DIMMED`, Warning level `WARNING`, Badge `Offline`.
6. **`UNKNOWN`:**
   - Home department workstation, neutral visual mode `UNKNOWN`.

---

## 5. Movement & Animation Rules

- **Zero Artificial Wander:** Sprites transition between rooms *only* when their derived operational state changes (e.g. from `IDLE` in Lounge to `WORKING` at desk).
- **CSS Transitions:** Position shifts and state changes are handled purely via lightweight CSS transitions (`transform`, `opacity`), avoiding requestAnimationFrame or tick loops.
- **Reduced Motion:** When `@media (prefers-reduced-motion: reduce)` is active, animations and transitions are clamped to 0.01ms.

---

## 6. Data Flow & Telemetry Ingestion

```
Cloudflare D1 / Hermes Daemons
      │
      ▼
Mission Control Core (health, pipeline, scheduler, jev, activity)
      │
      ▼
Staff Registry (deriveStaffState, deriveStaffCurrentTask)
      │
      ▼
Department Operations (health, workload, blockers, handoffs)
      │
      ▼
Pixel Office Model (`getPixelOfficeState`)
   ├── Position Registry lookup
   ├── State Reason evaluation (intentional vs failure)
   ├── Room occupancy grouping
   └── Summary compilation
      │
      ├─► JSON API: `/api/admin/mission-control/office`
      └─► UI Page: `/admin/mission-control/office`
```

---

## 7. Interactive Inspection (Read-Only)

- **Staff Click:** Opens inspect modal displaying canonical `agent_id`, display name, role, department, current task, machine capabilities, and last activity timestamp. Includes link to Staff Registry (`/admin/mission-control/staff?staff=agent_id`).
- **Room Click:** Opens room modal displaying room health, evaluation evidence, active task count, blocker count, and occupants list. Includes link to Department detail page (`/admin/mission-control/departments/[id]`).
- **Strict Invariant:** Modals contain zero mutation controls (no retry, no publish, no worker toggles, no chat).

---

## 8. Verification & Test Coverage

All 20 test specifications in `scripts/test-mission-control-pixel-office.js` pass with 100% success rate:
- Avatar keys validity
- Home rooms validity
- Office position coordinates integrity
- WORKING -> department desk mapping
- IDLE -> lounge seats mapping
- REVIEWING -> review desk mapping
- BLOCKED -> critical warning beacon
- OFFLINE intentional vs failure differentiation
- UNKNOWN safe handling
- Zero random positions & zero fake movement
- Non-overlapping seat assignments
- Social room unstaffed invariant
- Read-only model without write methods
- Reduced-motion compatibility
- Current task telemetry sourcing
- Summary counters accuracy

---

## 9. Next Steps for HERMES-MC-5

With MC-4 complete, the foundational spatial visualization layer is in place. MC-5 will introduce unified activity & task correlation overlays across the 2D office without altering runtime execution authority.
