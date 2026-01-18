// Clinic Layout Types

export interface LayoutRoom {
  id: string;
  type: 'waiting' | 'patient';
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export interface ClinicLayout {
  rooms: LayoutRoom[];
  gridCols: number;
  gridRows: number;
  createdAt: Date;
  updatedAt: Date;
}

// Default grid configuration
export const GRID_COLS = 12;
export const GRID_ROWS = 8;
export const CELL_SIZE = 60; // pixels per cell

// Room templates for the palette
export const ROOM_TEMPLATES: Omit<LayoutRoom, 'id' | 'x' | 'y'>[] = [
  {
    type: 'waiting',
    width: 3,
    height: 2,
    name: 'Waiting Room',
  },
  {
    type: 'patient',
    width: 2,
    height: 2,
    name: 'Patient Room',
  },
];

// Generate unique room ID
export function generateRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create a new room from template
export function createRoom(
  template: Omit<LayoutRoom, 'id' | 'x' | 'y'>,
  x: number = 0,
  y: number = 0,
  index?: number
): LayoutRoom {
  return {
    id: generateRoomId(),
    type: template.type,
    x,
    y,
    width: template.width,
    height: template.height,
    name: index !== undefined 
      ? `${template.name} ${index + 1}` 
      : template.name,
  };
}

// Check if a room position is valid (within bounds and no overlap)
export function isValidPosition(
  room: LayoutRoom,
  rooms: LayoutRoom[],
  gridCols: number = GRID_COLS,
  gridRows: number = GRID_ROWS
): boolean {
  // Check bounds
  if (room.x < 0 || room.y < 0) return false;
  if (room.x + room.width > gridCols) return false;
  if (room.y + room.height > gridRows) return false;

  // Check overlap with other rooms
  for (const other of rooms) {
    if (other.id === room.id) continue;
    if (roomsOverlap(room, other)) return false;
  }

  return true;
}

// Check if two rooms overlap
export function roomsOverlap(a: LayoutRoom, b: LayoutRoom): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

// Find the next available position for a room
export function findNextPosition(
  room: Omit<LayoutRoom, 'x' | 'y'> & { id: string },
  rooms: LayoutRoom[],
  gridCols: number = GRID_COLS,
  gridRows: number = GRID_ROWS
): { x: number; y: number } | null {
  for (let y = 0; y <= gridRows - room.height; y++) {
    for (let x = 0; x <= gridCols - room.width; x++) {
      const testRoom = { ...room, x, y } as LayoutRoom;
      if (isValidPosition(testRoom, rooms, gridCols, gridRows)) {
        return { x, y };
      }
    }
  }
  return null;
}

// Serialize layout for storage
export function serializeLayout(layout: ClinicLayout): string {
  return JSON.stringify({
    ...layout,
    createdAt: layout.createdAt.toISOString(),
    updatedAt: layout.updatedAt.toISOString(),
  });
}

// Deserialize layout from storage
export function deserializeLayout(data: string): ClinicLayout {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
  };
}

// Create default empty layout
export function createEmptyLayout(): ClinicLayout {
  return {
    rooms: [],
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
