"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  DragMoveEvent,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  type LayoutRoom,
  type ClinicLayout,
  ROOM_TEMPLATES,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  createRoom,
  isValidPosition,
  findNextPosition,
  generateRoomId,
} from "@/types/layout";
import { Button, Input, Modal, ModalFooter } from "@/components/ui";

interface LayoutBuilderProps {
  layout: ClinicLayout;
  onChange: (layout: ClinicLayout) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

type GrabOffset = {
  x: number;
  y: number;
  baseWidth: number;
  baseHeight: number;
};

type RoomSize = Pick<LayoutRoom, "width" | "height">;

// Palette item component (draggable)
function PaletteItem({ template, index }: { template: typeof ROOM_TEMPLATES[0]; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${template.type}-${index}`,
    data: { type: 'palette', template },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-150",
        template.type === 'waiting'
          ? "bg-info-50 border-info-200 dark:bg-info-900/20 dark:border-info-800"
          : "bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800",
        isDragging && "opacity-50"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          template.type === 'waiting'
            ? "bg-info-500 text-white"
            : "bg-success-500 text-white"
        )}
      >
        {template.type === 'waiting' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>
      <div>
        <p className={cn(
          "text-sm font-medium",
          template.type === 'waiting'
            ? "text-info-700 dark:text-info-600"
            : "text-success-700 dark:text-success-600"
        )}>
          {template.name}
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {template.width}×{template.height} cells
        </p>
      </div>
    </div>
  );
}

// Grid room component (draggable + resizable)
function GridRoom({
  room,
  cellSize,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
}: {
  room: LayoutRoom;
  cellSize: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: room.id,
    data: { type: 'room', room },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        position: 'absolute',
        left: room.x * cellSize,
        top: room.y * cellSize,
        width: room.width * cellSize - 4,
        height: room.height * cellSize - 4,
      }}
      className={cn(
        "rounded-xl border-2 transition-colors duration-150 cursor-move",
        room.type === 'waiting'
          ? "bg-info-50 border-info-300 dark:bg-info-900/30 dark:border-info-700"
          : "bg-success-50 border-success-300 dark:bg-success-900/30 dark:border-success-700",
        isSelected && "ring-2 ring-accent-500 ring-offset-2 dark:ring-offset-neutral-900",
        isDragging && "opacity-0 pointer-events-none"
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className="w-full h-full p-2 flex flex-col"
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs font-semibold truncate",
              room.type === 'waiting'
                ? "text-info-700 dark:text-info-600"
                : "text-success-700 dark:text-success-300"
            )}>
              {room.name}
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {room.type === 'waiting' ? 'Waiting' : 'Patient'}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons - show on selection */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-6 h-6 rounded-full bg-accent-500 text-white flex items-center justify-center shadow-md hover:bg-accent-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-6 h-6 rounded-full bg-error-500 text-white flex items-center justify-center shadow-md hover:bg-error-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function StaticRoom({ room, cellSize }: { room: LayoutRoom; cellSize: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: room.x * cellSize,
        top: room.y * cellSize,
        width: room.width * cellSize - 4,
        height: room.height * cellSize - 4,
      }}
      className={cn(
        "rounded-xl border-2",
        room.type === 'waiting'
          ? "bg-info-50 border-info-300 dark:bg-info-900/30 dark:border-info-700"
          : "bg-success-50 border-success-300 dark:bg-success-900/30 dark:border-success-700"
      )}
    >
      <div className="w-full h-full p-2 flex flex-col">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs font-semibold truncate",
              room.type === 'waiting'
                ? "text-info-700 dark:text-info-600"
                : "text-success-700 dark:text-success-300"
            )}>
              {room.name}
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {room.type === 'waiting' ? 'Waiting' : 'Patient'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Grid cell component (droppable)
function GridCell({ x, y, cellSize, isHighlighted }: { x: number; y: number; cellSize: number; isHighlighted: boolean }) {
  const { setNodeRef } = useDroppable({
    id: `cell-${x}-${y}`,
    data: { x, y },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        width: cellSize,
        height: cellSize,
      }}
      className={cn(
        "border border-neutral-200 dark:border-neutral-700 transition-colors duration-75",
        isHighlighted && "bg-accent-200 dark:bg-accent-800/40 border-accent-300 dark:border-accent-600"
      )}
    />
  );
}

// Drag overlay for visual feedback
function DragOverlayContent({ room, cellSize }: { room: LayoutRoom; cellSize: number }) {
  return (
    <div
      style={{
        width: room.width * cellSize - 4,
        height: room.height * cellSize - 4,
      }}
      className={cn(
        "rounded-xl border-2 opacity-80",
        room.type === 'waiting'
          ? "bg-info-100 border-info-400"
          : "bg-success-100 border-success-400"
      )}
    >
      <div className="w-full h-full p-2">
        <p className={cn(
          "text-xs font-semibold",
          room.type === 'waiting' ? "text-info-700" : "text-success-700"
        )}>
          {room.name}
        </p>
      </div>
    </div>
  );
}

export function LayoutBuilder({ layout, onChange, onSave, isSaving }: LayoutBuilderProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<LayoutRoom | null>(null);
  const [editingRoom, setEditingRoom] = useState<LayoutRoom | null>(null);
  const [editName, setEditName] = useState("");
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [grabOffset, setGrabOffset] = useState<GrabOffset>({
    x: 0,
    y: 0,
    baseWidth: 0,
    baseHeight: 0,
  });
  const lastDragPosition = useRef<{ x: number; y: number } | null>(null);
  const [cellSize, setCellSize] = useState(CELL_SIZE);
  const [isEditing, setIsEditing] = useState(true);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced for more responsive dragging
      },
    })
  );

  useEffect(() => {
    if (!gridWrapperRef.current) return;

    const updateCellSize = () => {
      const width = gridWrapperRef.current?.clientWidth ?? 0;
      if (!width) return;
      const nextSize = width / GRID_COLS;
      setCellSize((prev) => (Math.abs(prev - nextSize) > 0.1 ? nextSize : prev));
    };

    updateCellSize();
    const observer = new ResizeObserver(updateCellSize);
    observer.observe(gridWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate grid position from pointer coordinates
  // Uses the top-left corner logic with grab offset compensation
  const getGridPosition = useCallback((pointerX: number, pointerY: number, room: RoomSize | null) => {
    if (!gridRef.current || !room) return null;

    const rect = gridRef.current.getBoundingClientRect();
    const overlayWidth = room.width * cellSize - 4;
    const overlayHeight = room.height * cellSize - 4;
    const offsetX = grabOffset.baseWidth
      ? (grabOffset.x / grabOffset.baseWidth) * overlayWidth
      : grabOffset.x;
    const offsetY = grabOffset.baseHeight
      ? (grabOffset.y / grabOffset.baseHeight) * overlayHeight
      : grabOffset.y;

    // Calculate the top-left corner of where the item would be placed
    // by subtracting the grab offset from pointer position
    const itemLeftEdge = pointerX - offsetX;
    const itemTopEdge = pointerY - offsetY;

    // Now calculate relative to grid
    const relativeX = itemLeftEdge - rect.left;
    const relativeY = itemTopEdge - rect.top;

    // Snap to grid using floor
    const gridX = Math.floor(relativeX / cellSize);
    const gridY = Math.floor(relativeY / cellSize);

    // Clamp to valid grid bounds (accounting for room size)
    const maxX = GRID_COLS - room.width;
    const maxY = GRID_ROWS - room.height;
    const clampedX = Math.max(0, Math.min(gridX, maxX));
    const clampedY = Math.max(0, Math.min(gridY, maxY));

    return { x: clampedX, y: clampedY };
  }, [cellSize, grabOffset]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    lastDragPosition.current = null;
    setDragPosition(null);

    // Calculate grab offset - where on the item did the user click?
    // This makes the item feel "pinned" to the cursor at the grab point
    const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent | TouchEvent;
    let pointerX = 0;
    let pointerY = 0;
    
    if ('clientX' in activatorEvent) {
      pointerX = activatorEvent.clientX;
      pointerY = activatorEvent.clientY;
    } else if ('touches' in activatorEvent && activatorEvent.touches.length > 0) {
      pointerX = activatorEvent.touches[0].clientX;
      pointerY = activatorEvent.touches[0].clientY;
    }

    // Get the element's bounding rect to calculate offset
    const activeRect = active.rect.current.initial;
    if (activeRect) {
      // Offset is how far from the top-left corner of the item we grabbed
      const offsetX = pointerX - activeRect.left;
      const offsetY = pointerY - activeRect.top;
      setGrabOffset({
        x: offsetX,
        y: offsetY,
        baseWidth: activeRect.width,
        baseHeight: activeRect.height,
      });
    } else {
      // Default to zero offsets when rect isn't available
      setGrabOffset({ x: 0, y: 0, baseWidth: 0, baseHeight: 0 });
    }

    if (data?.type === 'palette') {
      // Creating a new room from palette
      const template = data.template;
      const roomCount = layout.rooms.filter(r => r.type === template.type).length;
      const newRoom = createRoom(template, 0, 0, roomCount);
      setActiveRoom(newRoom);
    } else if (data?.type === 'room') {
      setActiveRoom(data.room);
    }
  }, [layout.rooms]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // Get current pointer position from the underlying event
    const pointerEvent = event.activatorEvent as PointerEvent | MouseEvent;
    if (!pointerEvent || !('clientX' in pointerEvent)) return;
    
    // Current pointer position = initial position + delta
    const currentPointerX = pointerEvent.clientX + event.delta.x;
    const currentPointerY = pointerEvent.clientY + event.delta.y;
    
    // Calculate grid position accounting for grab offset
    const activeData = event.active.data.current;
    const roomSize = activeRoom
      ? { width: activeRoom.width, height: activeRoom.height }
      : activeData?.type === 'palette'
        ? { width: activeData.template.width, height: activeData.template.height }
        : activeData?.type === 'room'
          ? { width: activeData.room.width, height: activeData.room.height }
          : null;
    const pos = getGridPosition(currentPointerX, currentPointerY, roomSize);
    if (!pos) return;

    const lastPos = lastDragPosition.current;
    if (!lastPos || lastPos.x !== pos.x || lastPos.y !== pos.y) {
      lastDragPosition.current = pos;
      setDragPosition(pos);
    }
  }, [activeRoom, getGridPosition]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta, activatorEvent } = event;
    const activeData = active.data.current;
    const clearDragState = () => {
      setActiveRoom(null);
      setDragPosition(null);
      lastDragPosition.current = null;
    };

    // Calculate final position using the same logic as drag move
    const pointerEvent = activatorEvent as PointerEvent | MouseEvent;
    if (!pointerEvent || !('clientX' in pointerEvent)) {
      clearDragState();
      return;
    }
    
    const finalPointerX = pointerEvent.clientX + delta.x;
    const finalPointerY = pointerEvent.clientY + delta.y;
    
    const roomSize = activeRoom
      ? { width: activeRoom.width, height: activeRoom.height }
      : activeData?.type === 'palette'
        ? { width: activeData.template.width, height: activeData.template.height }
        : activeData?.type === 'room'
          ? { width: activeData.room.width, height: activeData.room.height }
          : null;
    const finalPosition = getGridPosition(finalPointerX, finalPointerY, roomSize);
    if (!finalPosition) {
      clearDragState();
      return;
    }

    const { x, y } = finalPosition;

    if (activeData?.type === 'palette') {
      // Adding new room from palette
      const template = activeData.template;
      const roomCount = layout.rooms.filter(r => r.type === template.type).length;
      const newRoom = createRoom(template, x, y, roomCount);

      if (isValidPosition(newRoom, layout.rooms)) {
        onChange({
          ...layout,
          rooms: [...layout.rooms, newRoom],
          updatedAt: new Date(),
        });
        setSelectedRoomId(newRoom.id);
      }
    } else if (activeData?.type === 'room') {
      // Moving existing room
      const room = activeData.room as LayoutRoom;
      const movedRoom = { ...room, x, y };

      if (isValidPosition(movedRoom, layout.rooms)) {
        onChange({
          ...layout,
          rooms: layout.rooms.map(r => r.id === room.id ? movedRoom : r),
          updatedAt: new Date(),
        });
      }
    }

    clearDragState();
  }, [layout, onChange, getGridPosition, activeRoom]);

  const handleDeleteRoom = useCallback((roomId: string) => {
    onChange({
      ...layout,
      rooms: layout.rooms.filter(r => r.id !== roomId),
      updatedAt: new Date(),
    });
    setSelectedRoomId(null);
  }, [layout, onChange]);

  const handleEditRoom = useCallback((room: LayoutRoom) => {
    setEditingRoom(room);
    setEditName(room.name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingRoom || !editName.trim()) return;

    onChange({
      ...layout,
      rooms: layout.rooms.map(r =>
        r.id === editingRoom.id ? { ...r, name: editName.trim() } : r
      ),
      updatedAt: new Date(),
    });
    setEditingRoom(null);
    setEditName("");
  }, [editingRoom, editName, layout, onChange]);

  const handleQuickAdd = useCallback((template: typeof ROOM_TEMPLATES[0]) => {
    const roomCount = layout.rooms.filter(r => r.type === template.type).length;
    const newRoom = createRoom(template, 0, 0, roomCount);
    const position = findNextPosition(newRoom, layout.rooms);

    if (position) {
      const roomWithPosition = { ...newRoom, ...position };
      onChange({
        ...layout,
        rooms: [...layout.rooms, roomWithPosition],
        updatedAt: new Date(),
      });
      setSelectedRoomId(newRoom.id);
    }
  }, [layout, onChange]);

  const handleSaveLayout = useCallback(() => {
    if (!onSave) return;
    onSave();
    setIsEditing(false);
    setSelectedRoomId(null);
    setEditingRoom(null);
    setEditName("");
  }, [onSave]);

  const handleAdjustLayout = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleResetLayout = useCallback(() => {
    if (layout.rooms.length === 0) return;
    const confirmed = window.confirm("Confirm reset clinic layout? This will remove all rooms.");
    if (!confirmed) return;

    onChange({
      ...layout,
      rooms: [],
      updatedAt: new Date(),
    });
    setSelectedRoomId(null);
    setEditingRoom(null);
    setEditName("");
  }, [layout, onChange]);

  const hasRooms = layout.rooms.length > 0;
  const showEditor = isEditing || !onSave;
  const layoutHeader = (
    <div className="flex items-center justify-between">
      <div>
        <h3 className={cn(
          "text-sm font-semibold",
          isEditing ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"
        )}>
          Clinic Layout
        </h3>
        <p className={cn(
          "text-xs",
          isEditing ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-400 dark:text-neutral-500"
        )}>
          {layout.rooms.length} room{layout.rooms.length !== 1 ? 's' : ''} placed
        </p>
      </div>
      {onSave && (
        <div className="flex items-center gap-2">
          <Button
            onClick={isEditing ? handleSaveLayout : handleAdjustLayout}
            isLoading={isEditing && isSaving}
            size="sm"
          >
            {isEditing ? "Save Layout" : "Adjust Layout"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleResetLayout}
            disabled={!hasRooms}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {showEditor ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Room Palette
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Drag rooms to the grid or click to add automatically.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {ROOM_TEMPLATES.map((template, index) => (
                  <div key={template.type} className="space-y-2">
                    <PaletteItem template={template} index={index} />
                    <button
                      onClick={() => handleQuickAdd(template)}
                      className={cn(
                        "w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors",
                        template.type === 'waiting'
                          ? "text-white bg-info-700 hover:bg-info-800 dark:bg-info-600 dark:hover:bg-info-500"
                          : "text-white bg-success-700 hover:bg-success-800 dark:bg-success-600 dark:hover:bg-success-500"
                      )}
                    >
                      + Quick Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {layoutHeader}

            <div ref={gridWrapperRef} className="w-full">
              {/* Grid */}
              <div
                ref={gridRef}
                className="relative rounded-xl border-2 border-neutral-300 dark:border-neutral-600 overflow-hidden bg-white dark:bg-neutral-900"
                style={{
                  width: GRID_COLS * cellSize,
                  height: GRID_ROWS * cellSize,
                }}
                onClick={() => setSelectedRoomId(null)}
              >
                {/* Grid cells */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)` }}>
                  {Array.from({ length: GRID_ROWS }).map((_, cellY) =>
                    Array.from({ length: GRID_COLS }).map((_, cellX) => {
                      // Check if this cell is in the drop target area
                      const isInDropArea = dragPosition && activeRoom && 
                        cellX >= dragPosition.x && 
                        cellX < dragPosition.x + activeRoom.width &&
                        cellY >= dragPosition.y && 
                        cellY < dragPosition.y + activeRoom.height;
                      
                      return (
                        <GridCell
                          key={`${cellX}-${cellY}`}
                          x={cellX}
                          y={cellY}
                          cellSize={cellSize}
                          isHighlighted={!!isInDropArea}
                        />
                      );
                    })
                  )}
                </div>

                {/* Placed rooms */}
                {layout.rooms.map((room) => (
                  <GridRoom
                    key={room.id}
                    room={room}
                    cellSize={cellSize}
                    isSelected={selectedRoomId === room.id}
                    onSelect={() => setSelectedRoomId(room.id)}
                    onDelete={() => handleDeleteRoom(room.id)}
                    onEdit={() => handleEditRoom(room)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeRoom && (
              <DragOverlayContent room={activeRoom} cellSize={cellSize} />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {layoutHeader}
          <div ref={gridWrapperRef} className="w-full">
            <div
              ref={gridRef}
              className="relative rounded-xl border-2 border-neutral-200 dark:border-neutral-800 overflow-hidden bg-transparent opacity-80"
              style={{
                width: GRID_COLS * cellSize,
                height: GRID_ROWS * cellSize,
              }}
            >
              {layout.rooms.map((room) => (
                <StaticRoom key={room.id} room={room} cellSize={cellSize} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      <Modal
        isOpen={!!editingRoom}
        onClose={() => setEditingRoom(null)}
        title="Edit Room"
      >
        <div className="space-y-4">
          <Input
            label="Room Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Enter room name"
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setEditingRoom(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}


// "use client";

// import { useState, useCallback, useMemo, useRef } from "react";
// import {
//   DndContext,
//   DragOverlay,
//   DragMoveEvent,
//   useDraggable,
//   useDroppable,
//   DragStartEvent,
//   DragEndEvent,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   pointerWithin,
//   rectIntersection,
// } from "@dnd-kit/core";
// import { cn } from "@/lib/utils";
// import {
//   type LayoutRoom,
//   type ClinicLayout,
//   ROOM_TEMPLATES,
//   GRID_COLS,
//   GRID_ROWS,
//   CELL_SIZE,
//   createRoom,
//   isValidPosition,
//   findNextPosition,
//   generateRoomId,
// } from "@/types/layout";
// import { Button, Input, Modal, ModalFooter } from "@/components/ui";

// interface LayoutBuilderProps {
//   layout: ClinicLayout;
//   onChange: (layout: ClinicLayout) => void;
//   onSave?: () => void;
//   isSaving?: boolean;
// }

// // Palette item component (draggable)
// function PaletteItem({ template, index }: { template: typeof ROOM_TEMPLATES[0]; index: number }) {
//   const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
//     id: `palette-${template.type}-${index}`,
//     data: { type: 'palette', template },
//   });

//   return (
//     <div
//       ref={setNodeRef}
//       {...listeners}
//       {...attributes}
//       className={cn(
//         "flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-150",
//         template.type === 'waiting'
//           ? "bg-info-50 border-info-200 dark:bg-info-900/20 dark:border-info-800"
//           : "bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800",
//         isDragging && "opacity-50"
//       )}
//     >
//       <div
//         className={cn(
//           "w-8 h-8 rounded-lg flex items-center justify-center",
//           template.type === 'waiting'
//             ? "bg-info-500 text-white"
//             : "bg-success-500 text-white"
//         )}
//       >
//         {template.type === 'waiting' ? (
//           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//           </svg>
//         ) : (
//           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
//           </svg>
//         )}
//       </div>
//       <div>
//         <p className={cn(
//           "text-sm font-medium",
//           template.type === 'waiting'
//             ? "text-info-700 dark:text-info-300"
//             : "text-success-700 dark:text-success-300"
//         )}>
//           {template.name}
//         </p>
//         <p className="text-xs text-neutral-600 dark:text-neutral-400">
//           {template.width}×{template.height} cells
//         </p>
//       </div>
//     </div>
//   );
// }

// // Grid room component (draggable + resizable)
// function GridRoom({
//   room,
//   cellSize,
//   isSelected,
//   onSelect,
//   onDelete,
//   onEdit,
// }: {
//   room: LayoutRoom;
//   cellSize: number;
//   isSelected: boolean;
//   onSelect: () => void;
//   onDelete: () => void;
//   onEdit: () => void;
// }) {
//   const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
//     id: room.id,
//     data: { type: 'room', room },
//   });

//   return (
//     <div
//       ref={setNodeRef}
//       onClick={(e) => {
//         e.stopPropagation();
//         onSelect();
//       }}
//       style={{
//         position: 'absolute',
//         left: room.x * cellSize,
//         top: room.y * cellSize,
//         width: room.width * cellSize - 4,
//         height: room.height * cellSize - 4,
//       }}
//       className={cn(
//         "rounded-xl border-2 transition-all duration-150 cursor-move",
//         room.type === 'waiting'
//           ? "bg-info-50 border-info-300 dark:bg-info-900/30 dark:border-info-700"
//           : "bg-success-50 border-success-300 dark:bg-success-900/30 dark:border-success-700",
//         isSelected && "ring-2 ring-accent-500 ring-offset-2 dark:ring-offset-neutral-900",
//         isDragging && "opacity-50 z-50"
//       )}
//     >
//       <div
//         {...listeners}
//         {...attributes}
//         className="w-full h-full p-2 flex flex-col"
//       >
//         <div className="flex items-start justify-between gap-1">
//           <div className="min-w-0 flex-1">
//             <p className={cn(
//               "text-xs font-semibold truncate",
//               room.type === 'waiting'
//                 ? "text-info-700 dark:text-info-300"
//                 : "text-success-700 dark:text-success-300"
//             )}>
//               {room.name}
//             </p>
//             <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
//               {room.type === 'waiting' ? 'Waiting' : 'Patient'}
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Action buttons - show on selection */}
//       {isSelected && (
//         <div className="absolute -top-2 -right-2 flex gap-1">
//           <button
//             onClick={(e) => {
//               e.stopPropagation();
//               onEdit();
//             }}
//             className="w-6 h-6 rounded-full bg-accent-500 text-white flex items-center justify-center shadow-md hover:bg-accent-600 transition-colors"
//           >
//             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
//             </svg>
//           </button>
//           <button
//             onClick={(e) => {
//               e.stopPropagation();
//               onDelete();
//             }}
//             className="w-6 h-6 rounded-full bg-error-500 text-white flex items-center justify-center shadow-md hover:bg-error-600 transition-colors"
//           >
//             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//             </svg>
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // Grid cell component (droppable)
// function GridCell({ x, y, cellSize, isHighlighted }: { x: number; y: number; cellSize: number; isHighlighted: boolean }) {
//   const { setNodeRef, isOver } = useDroppable({
//     id: `cell-${x}-${y}`,
//     data: { x, y },
//   });

//   return (
//     <div
//       ref={setNodeRef}
//       style={{
//         width: cellSize,
//         height: cellSize,
//       }}
//       className={cn(
//         "border border-neutral-200 dark:border-neutral-700 transition-colors duration-75",
//         (isOver || isHighlighted) && "bg-accent-200 dark:bg-accent-800/40 border-accent-300 dark:border-accent-600"
//       )}
//     />
//   );
// }

// // Drag overlay for visual feedback
// function DragOverlayContent({ room, cellSize }: { room: LayoutRoom; cellSize: number }) {
//   return (
//     <div
//       style={{
//         width: room.width * cellSize - 4,
//         height: room.height * cellSize - 4,
//       }}
//       className={cn(
//         "rounded-xl border-2 opacity-80",
//         room.type === 'waiting'
//           ? "bg-info-100 border-info-400"
//           : "bg-success-100 border-success-400"
//       )}
//     >
//       <div className="w-full h-full p-2">
//         <p className={cn(
//           "text-xs font-semibold",
//           room.type === 'waiting' ? "text-info-700" : "text-success-700"
//         )}>
//           {room.name}
//         </p>
//       </div>
//     </div>
//   );
// }

// export function LayoutBuilder({ layout, onChange, onSave, isSaving }: LayoutBuilderProps) {
//   const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
//   const [activeRoom, setActiveRoom] = useState<LayoutRoom | null>(null);
//   const [editingRoom, setEditingRoom] = useState<LayoutRoom | null>(null);
//   const [editName, setEditName] = useState("");
//   const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
//   const [grabOffset, setGrabOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
//   const gridRef = useRef<HTMLDivElement>(null);

//   const sensors = useSensors(
//     useSensor(PointerSensor, {
//       activationConstraint: {
//         distance: 3, // Reduced for more responsive dragging
//       },
//     })
//   );

//   // Calculate responsive cell size
//   const cellSize = useMemo(() => {
//     if (typeof window === 'undefined') return CELL_SIZE;
//     const maxWidth = Math.min(800, window.innerWidth - 300);
//     return Math.floor(maxWidth / GRID_COLS);
//   }, []);

//   // Calculate grid position from pointer coordinates
//   // Uses the top-left corner logic with grab offset compensation
//   const getGridPosition = useCallback((pointerX: number, pointerY: number, offsetX: number = 0, offsetY: number = 0) => {
//     if (!gridRef.current) return null;
    
//     const rect = gridRef.current.getBoundingClientRect();
    
//     // Calculate the top-left corner of where the item would be placed
//     // by subtracting the grab offset from pointer position
//     const itemLeftEdge = pointerX - offsetX;
//     const itemTopEdge = pointerY - offsetY;
    
//     // Now calculate relative to grid
//     const relativeX = itemLeftEdge - rect.left;
//     const relativeY = itemTopEdge - rect.top;
    
//     // Snap to grid using floor
//     const gridX = Math.floor(relativeX / cellSize);
//     const gridY = Math.floor(relativeY / cellSize);
    
//     // Clamp to valid grid bounds
//     const clampedX = Math.max(0, Math.min(gridX, GRID_COLS - 1));
//     const clampedY = Math.max(0, Math.min(gridY, GRID_ROWS - 1));
    
//     return { x: clampedX, y: clampedY };
//   }, [cellSize]);

//   const handleDragStart = useCallback((event: DragStartEvent) => {
//     const { active } = event;
//     const data = active.data.current;

//     // Calculate grab offset - where on the item did the user click?
//     // This makes the item feel "pinned" to the cursor at the grab point
//     const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent | TouchEvent;
//     let pointerX = 0;
//     let pointerY = 0;
    
//     if ('clientX' in activatorEvent) {
//       pointerX = activatorEvent.clientX;
//       pointerY = activatorEvent.clientY;
//     } else if ('touches' in activatorEvent && activatorEvent.touches.length > 0) {
//       pointerX = activatorEvent.touches[0].clientX;
//       pointerY = activatorEvent.touches[0].clientY;
//     }

//     // Get the element's bounding rect to calculate offset
//     const activeRect = active.rect.current.initial;
//     if (activeRect) {
//       // Offset is how far from the top-left corner of the item we grabbed
//       const offsetX = pointerX - activeRect.left;
//       const offsetY = pointerY - activeRect.top;
//       setGrabOffset({ x: offsetX, y: offsetY });
//     } else {
//       // Default to center for new items from palette
//       setGrabOffset({ x: 0, y: 0 });
//     }

//     if (data?.type === 'palette') {
//       // Creating a new room from palette - for palette items, 
//       // we want the top-left to be at cursor, so offset is 0
//       const template = data.template;
//       const roomCount = layout.rooms.filter(r => r.type === template.type).length;
//       const newRoom = createRoom(template, 0, 0, roomCount);
//       setActiveRoom(newRoom);
//       // For palette items, use small offset so item appears near cursor
//       setGrabOffset({ x: cellSize / 2, y: cellSize / 2 });
//     } else if (data?.type === 'room') {
//       setActiveRoom(data.room);
//     }
//   }, [layout.rooms, cellSize]);

//   const handleDragMove = useCallback((event: DragMoveEvent) => {
//     // Get current pointer position from the underlying event
//     const pointerEvent = event.activatorEvent as PointerEvent | MouseEvent;
//     if (!pointerEvent || !('clientX' in pointerEvent)) return;
    
//     // Current pointer position = initial position + delta
//     const currentPointerX = pointerEvent.clientX + event.delta.x;
//     const currentPointerY = pointerEvent.clientY + event.delta.y;
    
//     // Calculate grid position accounting for grab offset
//     const pos = getGridPosition(currentPointerX, currentPointerY, grabOffset.x, grabOffset.y);
//     setDragPosition(pos);
//   }, [getGridPosition, grabOffset]);

//   const handleDragEnd = useCallback((event: DragEndEvent) => {
//     const { active, delta, activatorEvent } = event;
//     setActiveRoom(null);
//     setDragPosition(null);

//     // Calculate final position using the same logic as drag move
//     const pointerEvent = activatorEvent as PointerEvent | MouseEvent;
//     if (!pointerEvent || !('clientX' in pointerEvent)) return;
    
//     const finalPointerX = pointerEvent.clientX + delta.x;
//     const finalPointerY = pointerEvent.clientY + delta.y;
    
//     const finalPosition = getGridPosition(finalPointerX, finalPointerY, grabOffset.x, grabOffset.y);
//     if (!finalPosition) return;

//     const { x, y } = finalPosition;
//     const activeData = active.data.current;

//     if (activeData?.type === 'palette') {
//       // Adding new room from palette
//       const template = activeData.template;
//       const roomCount = layout.rooms.filter(r => r.type === template.type).length;
//       const newRoom = createRoom(template, x, y, roomCount);

//       if (isValidPosition(newRoom, layout.rooms)) {
//         onChange({
//           ...layout,
//           rooms: [...layout.rooms, newRoom],
//           updatedAt: new Date(),
//         });
//         setSelectedRoomId(newRoom.id);
//       }
//     } else if (activeData?.type === 'room') {
//       // Moving existing room
//       const room = activeData.room as LayoutRoom;
//       const movedRoom = { ...room, x, y };

//       if (isValidPosition(movedRoom, layout.rooms)) {
//         onChange({
//           ...layout,
//           rooms: layout.rooms.map(r => r.id === room.id ? movedRoom : r),
//           updatedAt: new Date(),
//         });
//       }
//     }
//   }, [layout, onChange, getGridPosition, grabOffset]);

//   const handleDeleteRoom = useCallback((roomId: string) => {
//     onChange({
//       ...layout,
//       rooms: layout.rooms.filter(r => r.id !== roomId),
//       updatedAt: new Date(),
//     });
//     setSelectedRoomId(null);
//   }, [layout, onChange]);

//   const handleEditRoom = useCallback((room: LayoutRoom) => {
//     setEditingRoom(room);
//     setEditName(room.name);
//   }, []);

//   const handleSaveEdit = useCallback(() => {
//     if (!editingRoom || !editName.trim()) return;

//     onChange({
//       ...layout,
//       rooms: layout.rooms.map(r =>
//         r.id === editingRoom.id ? { ...r, name: editName.trim() } : r
//       ),
//       updatedAt: new Date(),
//     });
//     setEditingRoom(null);
//     setEditName("");
//   }, [editingRoom, editName, layout, onChange]);

//   const handleQuickAdd = useCallback((template: typeof ROOM_TEMPLATES[0]) => {
//     const roomCount = layout.rooms.filter(r => r.type === template.type).length;
//     const newRoom = createRoom(template, 0, 0, roomCount);
//     const position = findNextPosition(newRoom, layout.rooms);

//     if (position) {
//       const roomWithPosition = { ...newRoom, ...position };
//       onChange({
//         ...layout,
//         rooms: [...layout.rooms, roomWithPosition],
//         updatedAt: new Date(),
//       });
//       setSelectedRoomId(newRoom.id);
//     }
//   }, [layout, onChange]);

//   return (
//     <div className="flex flex-col lg:flex-row gap-6">
//       {/* Palette Panel */}
//       <div className="w-full lg:w-64 shrink-0">
//         <div className="sticky top-4 space-y-4">
//           <div>
//             <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
//               Room Palette
//             </h3>
//             <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
//               Drag rooms to the grid or click to add automatically.
//             </p>
//           </div>

//           <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
//             <div className="space-y-3">
//               {ROOM_TEMPLATES.map((template, index) => (
//                 <div key={template.type} className="space-y-2">
//                   <PaletteItem template={template} index={index} />
//                   <button
//                     onClick={() => handleQuickAdd(template)}
//                     className={cn(
//                       "w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors",
//                       template.type === 'waiting'
//                         ? "text-info-700 bg-info-100 hover:bg-info-200 dark:text-info-300 dark:bg-info-900/40 dark:hover:bg-info-900/60"
//                         : "text-success-700 bg-success-100 hover:bg-success-200 dark:text-success-300 dark:bg-success-900/40 dark:hover:bg-success-900/60"
//                     )}
//                   >
//                     + Quick Add
//                   </button>
//                 </div>
//               ))}
//             </div>

//             {/* Grid Panel */}
//             <div className="flex-1 mt-6 lg:mt-0">
//               <div className="flex items-center justify-between mb-4">
//                 <div>
//                   <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
//                     Clinic Layout
//                   </h3>
//                   <p className="text-xs text-neutral-500 dark:text-neutral-400">
//                     {layout.rooms.length} room{layout.rooms.length !== 1 ? 's' : ''} placed
//                   </p>
//                 </div>
//                 {onSave && (
//                   <Button onClick={onSave} isLoading={isSaving} size="sm">
//                     Save Layout
//                   </Button>
//                 )}
//               </div>

//               {/* Grid */}
//               <div
//                 ref={gridRef}
//                 className="relative rounded-xl border-2 border-neutral-300 dark:border-neutral-600 overflow-hidden bg-white dark:bg-neutral-900"
//                 style={{
//                   width: GRID_COLS * cellSize,
//                   height: GRID_ROWS * cellSize,
//                 }}
//                 onClick={() => setSelectedRoomId(null)}
//               >
//                 {/* Grid cells */}
//                 <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)` }}>
//                   {Array.from({ length: GRID_ROWS }).map((_, cellY) =>
//                     Array.from({ length: GRID_COLS }).map((_, cellX) => {
//                       // Check if this cell is in the drop target area
//                       const isInDropArea = dragPosition && activeRoom && 
//                         cellX >= dragPosition.x && 
//                         cellX < dragPosition.x + activeRoom.width &&
//                         cellY >= dragPosition.y && 
//                         cellY < dragPosition.y + activeRoom.height;
                      
//                       return (
//                         <GridCell
//                           key={`${cellX}-${cellY}`}
//                           x={cellX}
//                           y={cellY}
//                           cellSize={cellSize}
//                           isHighlighted={!!isInDropArea}
//                         />
//                       );
//                     })
//                   )}
//                 </div>

//                 {/* Placed rooms */}
//                 {layout.rooms.map((room) => (
//                   <GridRoom
//                     key={room.id}
//                     room={room}
//                     cellSize={cellSize}
//                     isSelected={selectedRoomId === room.id}
//                     onSelect={() => setSelectedRoomId(room.id)}
//                     onDelete={() => handleDeleteRoom(room.id)}
//                     onEdit={() => handleEditRoom(room)}
//                   />
//                 ))}
//               </div>
//             </div>

//             {/* Drag overlay */}
//             <DragOverlay>
//               {activeRoom && (
//                 <DragOverlayContent room={activeRoom} cellSize={cellSize} />
//               )}
//             </DragOverlay>
//           </DndContext>
//         </div>
//       </div>

//       {/* Edit Room Modal */}
//       <Modal
//         isOpen={!!editingRoom}
//         onClose={() => setEditingRoom(null)}
//         title="Edit Room"
//       >
//         <div className="space-y-4">
//           <Input
//             label="Room Name"
//             value={editName}
//             onChange={(e) => setEditName(e.target.value)}
//             placeholder="Enter room name"
//           />
//           <ModalFooter>
//             <Button variant="ghost" onClick={() => setEditingRoom(null)}>
//               Cancel
//             </Button>
//             <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
//               Save
//             </Button>
//           </ModalFooter>
//         </div>
//       </Modal>
//     </div>
//   );
// }
