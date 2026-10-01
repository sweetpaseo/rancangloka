/**
 * RancangLoka Hermes Mission Control — Pixel Office Route Graph & Deterministic Navigation
 * Milestone: HERMES-MC-4 / V2.3
 * 
 * Strict Invariants:
 * 1. PRESENTATION ONLY. Zero execution authority. Consumes canonical state only.
 * 2. NO REAL STATE TRANSITION = NO STAFF MOVEMENT. Zero random walking or ambient wandering.
 * 3. Paths follow physical office architecture: rooms connect only via physical doorways facing Central Hall.
 * 4. Central Hallway is the primary circulation spine uniting Left Wing and Right Wing.
 * 5. Deterministic pathfinding: same origin and destination ALWAYS yields the exact same shortest path.
 * 6. Respects physical obstacles: staff never walk through walls or jump across room partitions.
 */

export interface OfficeRouteNode {
  id: string;
  label: string;
  room_key: string;
  level: 1 | 2 | 3 | 4; // 1: Top, 2: Middle, 3: Bottom, 4: Annex
  wing: 'LEFT' | 'CENTER' | 'RIGHT' | 'ANNEX';
  x: number; // percentage (0 - 100) across total building interior width
  y: number; // percentage (0 - 100) across total building interior height
  is_doorway: boolean;
  is_workstation: boolean;
  is_lounge_seat: boolean;
}

export interface OfficeRouteEdge {
  from: string;
  to: string;
  weight: number;
}

// ============================================================================
// Canonical Route Graph Nodes
// ============================================================================

export const OFFICE_ROUTE_NODES: Record<string, OfficeRouteNode> = {
  // --- CENTRAL HALLWAY SPINE (Primary Circulation Backbone) ---
  hall_level_1: {
    id: 'hall_level_1',
    label: 'Koridor Utama — Lantai 1 (Editorial / Riset)',
    room_key: 'central_hall',
    level: 1,
    wing: 'CENTER',
    x: 50,
    y: 16,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: false
  },
  hall_level_2: {
    id: 'hall_level_2',
    label: 'Koridor Utama — Lantai 2 (Media / Telemetri)',
    room_key: 'central_hall',
    level: 2,
    wing: 'CENTER',
    x: 50,
    y: 45,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: false
  },
  hall_level_3: {
    id: 'hall_level_3',
    label: 'Koridor Utama — Lantai 3 (Publikasi / Lounge)',
    room_key: 'central_hall',
    level: 3,
    wing: 'CENTER',
    x: 50,
    y: 72,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: false
  },
  hall_south: {
    id: 'hall_south',
    label: 'Ujung Selatan Koridor (Terminus)',
    room_key: 'central_hall',
    level: 4,
    wing: 'CENTER',
    x: 50,
    y: 84,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: false
  },
  zone_s_threshold: {
    id: 'zone_s_threshold',
    label: 'Ambang Masuk Zone S (Social Annex)',
    room_key: 'central_hall',
    level: 4,
    wing: 'CENTER',
    x: 50,
    y: 89,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },

  // --- LEFT WING: LEVEL 1 (EDITORIAL) ---
  editorial_door: {
    id: 'editorial_door',
    label: 'Pintu Masuk Editorial (Sayap Kiri)',
    room_key: 'editorial_room',
    level: 1,
    wing: 'LEFT',
    x: 40,
    y: 16,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  editorial_writer_desk: {
    id: 'editorial_writer_desk',
    label: 'Meja Penulisan Joko (Editorial)',
    room_key: 'editorial_room',
    level: 1,
    wing: 'LEFT',
    x: 16,
    y: 16,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },
  editorial_review_desk: {
    id: 'editorial_review_desk',
    label: 'Meja Review Rina (Editorial)',
    room_key: 'editorial_room',
    level: 1,
    wing: 'LEFT',
    x: 28,
    y: 16,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },

  // --- LEFT WING: LEVEL 2 (LOKAMEDIA STUDIO) ---
  media_door: {
    id: 'media_door',
    label: 'Pintu Masuk LokaMedia Studio (Sayap Kiri)',
    room_key: 'media_room',
    level: 2,
    wing: 'LEFT',
    x: 40,
    y: 45,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  media_console: {
    id: 'media_console',
    label: 'Konsol Canvas Pro Budi (LokaMedia)',
    room_key: 'media_room',
    level: 2,
    wing: 'LEFT',
    x: 21,
    y: 45,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },

  // --- LEFT WING: LEVEL 3 (PUBLICATION OPERATIONS) ---
  publication_door: {
    id: 'publication_door',
    label: 'Pintu Masuk Publikasi (Sayap Kiri)',
    room_key: 'publication_room',
    level: 3,
    wing: 'LEFT',
    x: 40,
    y: 72,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  publication_console: {
    id: 'publication_console',
    label: 'Konsol Dispatch Sari (Publikasi)',
    room_key: 'publication_room',
    level: 3,
    wing: 'LEFT',
    x: 21,
    y: 72,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },

  // --- RIGHT WING: LEVEL 1 (RESEARCH LAB) ---
  research_door: {
    id: 'research_door',
    label: 'Pintu Masuk Riset (Sayap Kanan)',
    room_key: 'research_lab',
    level: 1,
    wing: 'RIGHT',
    x: 60,
    y: 16,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  research_main_desk: {
    id: 'research_main_desk',
    label: 'Konsol Riset Irwan (Research Lab)',
    room_key: 'research_lab',
    level: 1,
    wing: 'RIGHT',
    x: 77,
    y: 16,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },

  // --- RIGHT WING: LEVEL 2 (OPERATIONS & JEV) ---
  operations_door: {
    id: 'operations_door',
    label: 'Pintu Masuk Operasi & JEV (Sayap Kanan)',
    room_key: 'operations_room',
    level: 2,
    wing: 'RIGHT',
    x: 60,
    y: 45,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  operations_console: {
    id: 'operations_console',
    label: 'Konsol Telemetri Dimas (Operasi)',
    room_key: 'operations_room',
    level: 2,
    wing: 'RIGHT',
    x: 77,
    y: 45,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  },

  // --- RIGHT WING: LEVEL 3 (EXECUTIVE LOUNGE) ---
  lounge_door: {
    id: 'lounge_door',
    label: 'Pintu Masuk Executive Lounge (Sayap Kanan)',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 60,
    y: 72,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  lounge_seat_1: {
    id: 'lounge_seat_1',
    label: 'Lounge Sofa 1 (Kursi Siaga)',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 71,
    y: 69,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },
  lounge_seat_2: {
    id: 'lounge_seat_2',
    label: 'Lounge Sofa 2 (Kursi Siaga)',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 77,
    y: 69,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },
  lounge_seat_3: {
    id: 'lounge_seat_3',
    label: 'Lounge Sofa 3 (Kursi Siaga)',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 83,
    y: 69,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },
  lounge_seat_4: {
    id: 'lounge_seat_4',
    label: 'Lounge Sofa 4 (Kursi Siaga)',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 89,
    y: 69,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },
  lounge_seat_5: {
    id: 'lounge_seat_5',
    label: 'Meja Kopi Barat Lounge',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 74,
    y: 76,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },
  lounge_seat_6: {
    id: 'lounge_seat_6',
    label: 'Meja Kopi Timur Lounge',
    room_key: 'lounge',
    level: 3,
    wing: 'RIGHT',
    x: 86,
    y: 76,
    is_doorway: false,
    is_workstation: false,
    is_lounge_seat: true
  },

  // --- SOUTHERN ANNEX: ZONE S (SOCIAL DISTRIBUTION) ---
  social_door: {
    id: 'social_door',
    label: 'Pintu Masuk Zone S (Terkunci)',
    room_key: 'social_room',
    level: 4,
    wing: 'ANNEX',
    x: 50,
    y: 91,
    is_doorway: true,
    is_workstation: false,
    is_lounge_seat: false
  },
  social_workstation: {
    id: 'social_workstation',
    label: 'Workstation Maya (Zone S - Standby)',
    room_key: 'social_room',
    level: 4,
    wing: 'ANNEX',
    x: 42,
    y: 95,
    is_doorway: false,
    is_workstation: true,
    is_lounge_seat: false
  }
};

// ============================================================================
// Physical Route Graph Edges (Topological Constraints)
// ============================================================================

export const OFFICE_ROUTE_EDGES: OfficeRouteEdge[] = [
  // 1. Central Hallway Spine (strictly vertical circulation)
  { from: 'hall_level_1', to: 'hall_level_2', weight: 1 },
  { from: 'hall_level_2', to: 'hall_level_3', weight: 1 },
  { from: 'hall_level_3', to: 'hall_south', weight: 1 },
  { from: 'hall_south', to: 'zone_s_threshold', weight: 1 },

  // 2. Doorways opening to Central Hallway
  // Left Wing:
  { from: 'editorial_door', to: 'hall_level_1', weight: 1 },
  { from: 'media_door', to: 'hall_level_2', weight: 1 },
  { from: 'publication_door', to: 'hall_level_3', weight: 1 },
  // Right Wing:
  { from: 'research_door', to: 'hall_level_1', weight: 1 },
  { from: 'operations_door', to: 'hall_level_2', weight: 1 },
  { from: 'lounge_door', to: 'hall_level_3', weight: 1 },
  // Annex:
  { from: 'zone_s_threshold', to: 'social_door', weight: 1 },

  // 3. Room Interior Connections (Workstations <-> Room Doorways)
  // Editorial Room:
  { from: 'editorial_door', to: 'editorial_review_desk', weight: 1 },
  { from: 'editorial_review_desk', to: 'editorial_writer_desk', weight: 1 },
  { from: 'editorial_door', to: 'editorial_writer_desk', weight: 1 },

  // LokaMedia Studio:
  { from: 'media_door', to: 'media_console', weight: 1 },

  // Publication Operations:
  { from: 'publication_door', to: 'publication_console', weight: 1 },

  // Research Lab:
  { from: 'research_door', to: 'research_main_desk', weight: 1 },

  // Operations & JEV:
  { from: 'operations_door', to: 'operations_console', weight: 1 },

  // Executive Lounge (Door to seating nodes):
  { from: 'lounge_door', to: 'lounge_seat_1', weight: 1 },
  { from: 'lounge_door', to: 'lounge_seat_2', weight: 1 },
  { from: 'lounge_door', to: 'lounge_seat_3', weight: 1 },
  { from: 'lounge_door', to: 'lounge_seat_4', weight: 1 },
  { from: 'lounge_door', to: 'lounge_seat_5', weight: 1 },
  { from: 'lounge_door', to: 'lounge_seat_6', weight: 1 },

  // Zone S Interior:
  { from: 'social_door', to: 'social_workstation', weight: 1 }
];

// ============================================================================
// Adjacency Map Builder (Bi-directional Graph)
// ============================================================================

export function buildRouteAdjacencyMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const nodeId of Object.keys(OFFICE_ROUTE_NODES)) {
    map.set(nodeId, []);
  }

  for (const edge of OFFICE_ROUTE_EDGES) {
    if (!map.has(edge.from)) map.set(edge.from, []);
    if (!map.has(edge.to)) map.set(edge.to, []);

    const fromNeighbors = map.get(edge.from)!;
    const toNeighbors = map.get(edge.to)!;

    if (!fromNeighbors.includes(edge.to)) fromNeighbors.push(edge.to);
    if (!toNeighbors.includes(edge.from)) toNeighbors.push(edge.from);
  }

  // Sort neighbors lexicographically for 100% deterministic BFS exploration
  for (const [nodeId, neighbors] of map.entries()) {
    neighbors.sort();
  }

  return map;
}

const GLOBAL_ADJACENCY_MAP = buildRouteAdjacencyMap();

// ============================================================================
// Deterministic Shortest Pathfinding (BFS with Lexicographical Tie-breaking)
// ============================================================================

/**
 * Computes the unique deterministic shortest path between any two valid nodes.
 * Guarantees zero random behavior: same inputs will ALWAYS produce identical path.
 */
export function findDeterministicPath(
  fromNodeId: string,
  toNodeId: string,
  adjacencyMap: Map<string, string[]> = GLOBAL_ADJACENCY_MAP
): string[] {
  if (!OFFICE_ROUTE_NODES[fromNodeId]) {
    throw new Error(`Invalid route origin node: '${fromNodeId}'`);
  }
  if (!OFFICE_ROUTE_NODES[toNodeId]) {
    throw new Error(`Invalid route destination node: '${toNodeId}'`);
  }

  if (fromNodeId === toNodeId) {
    return [fromNodeId];
  }

  const queue: string[] = [fromNodeId];
  const visited = new Set<string>([fromNodeId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === toNodeId) {
      // Reconstruct path backwards
      const path: string[] = [];
      let step: string | undefined = toNodeId;
      while (step) {
        path.unshift(step);
        step = parent.get(step);
      }
      return path;
    }

    const neighbors = adjacencyMap.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  throw new Error(`No valid physical route exists between '${fromNodeId}' and '${toNodeId}'`);
}

// ============================================================================
// Facing Direction Derivation
// ============================================================================

export type FacingDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export function deriveFacingDirection(
  fromNodeId: string,
  toNodeId: string
): FacingDirection {
  const fromNode = OFFICE_ROUTE_NODES[fromNodeId];
  const toNode = OFFICE_ROUTE_NODES[toNodeId];

  if (!fromNode || !toNode) return 'DOWN';

  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  } else {
    return dy > 0 ? 'DOWN' : 'UP';
  }
}

// ============================================================================
// Hallway Lane Offsets (Avoid Visual Collisions in Hallway)
// ============================================================================

export interface NodeSpatialCoordinate {
  x: number;
  y: number;
}

export function getNodeVisualCoordinate(
  nodeId: string,
  staffIndex: number = 0,
  direction?: FacingDirection
): NodeSpatialCoordinate {
  const node = OFFICE_ROUTE_NODES[nodeId];
  if (!node) return { x: 50, y: 50 };

  let x = node.x;
  let y = node.y;

  // In the central hall, apply deterministic lanes:
  // Northbound (UP) travels on the left lane (-1.8%)
  // Southbound (DOWN) travels on the right lane (+1.8%)
  // Stagger staff by their deterministic index to prevent direct visual clipping
  if (node.room_key === 'central_hall') {
    if (direction === 'UP') {
      x -= 1.8;
    } else if (direction === 'DOWN') {
      x += 1.8;
    }
    // Micro-stagger per staff index (deterministic)
    const stagger = ((staffIndex % 3) - 1) * 0.8;
    x += stagger;
  }

  return { x, y };
}
