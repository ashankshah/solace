"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  type LayoutRoom,
  type ClinicLayout,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
} from "@/types/layout";

interface LayoutViewerProps {
  layout: ClinicLayout;
  onEditClick?: () => void;
  className?: string;
}

// Room component for viewing
function ViewerRoom({
  room,
  cellSize,
  isHovered,
  onHover,
  onLeave,
}: {
  room: LayoutRoom;
  cellSize: number;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        position: 'absolute',
        left: room.x * cellSize,
        top: room.y * cellSize,
        width: room.width * cellSize - 4,
        height: room.height * cellSize - 4,
      }}
      className={cn(
        "rounded-xl border-2 transition-all duration-200 cursor-pointer",
        room.type === 'waiting'
          ? "bg-info-50 border-info-200 dark:bg-info-900/30 dark:border-info-700"
          : "bg-success-50 border-success-200 dark:bg-success-900/30 dark:border-success-700",
        isHovered && [
          "shadow-lg z-10 scale-[1.02]",
          room.type === 'waiting'
            ? "border-info-400 dark:border-info-500"
            : "border-success-400 dark:border-success-500"
        ]
      )}
    >
      <div className="w-full h-full p-2 flex flex-col justify-between">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
              room.type === 'waiting'
                ? "bg-info-500 text-white"
                : "bg-success-500 text-white"
            )}
          >
            {room.type === 'waiting' ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs font-semibold truncate",
              room.type === 'waiting'
                ? "text-info-700 dark:text-info-300"
                : "text-success-700 dark:text-success-300"
            )}>
              {room.name}
            </p>
          </div>
        </div>
        
        {room.width * room.height >= 4 && (
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {room.type === 'waiting' ? 'Waiting Room' : 'Patient Room'}
          </p>
        )}
      </div>

      {/* Hover tooltip */}
      {isHovered && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
            <p className="font-semibold">{room.name}</p>
            <p className="text-neutral-400 dark:text-neutral-600">
              {room.type === 'waiting' ? 'Waiting Room' : 'Patient Room'} • {room.width}×{room.height}
            </p>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
              <div className="border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-100" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LayoutViewer({ layout, onEditClick, className }: LayoutViewerProps) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Calculate responsive cell size based on container
  const cellSize = useMemo(() => {
    if (typeof window === 'undefined') return CELL_SIZE;
    const maxWidth = Math.min(900, window.innerWidth - 64);
    return Math.floor(maxWidth / GRID_COLS);
  }, []);

  const gridWidth = GRID_COLS * cellSize;
  const gridHeight = GRID_ROWS * cellSize;

  if (layout.rooms.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8", className)}>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            No Layout Configured
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm mx-auto">
            Set up your clinic layout to visualize rooms and patient flow.
          </p>
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500 text-white font-medium text-sm hover:bg-accent-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Layout
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Clinic Layout
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {layout.rooms.filter(r => r.type === 'waiting').length} waiting room{layout.rooms.filter(r => r.type === 'waiting').length !== 1 ? 's' : ''} •{' '}
            {layout.rooms.filter(r => r.type === 'patient').length} patient room{layout.rooms.filter(r => r.type === 'patient').length !== 1 ? 's' : ''}
          </p>
        </div>
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        )}
      </div>

      {/* Grid Visualization */}
      <div className="overflow-x-auto">
        <div
          className="relative rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 mx-auto"
          style={{
            width: gridWidth,
            height: gridHeight,
          }}
        >
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundSize: `${cellSize}px ${cellSize}px`,
              backgroundImage: `
                linear-gradient(to right, var(--color-neutral-300) 1px, transparent 1px),
                linear-gradient(to bottom, var(--color-neutral-300) 1px, transparent 1px)
              `,
            }}
          />

          {/* Rooms */}
          {layout.rooms.map((room) => (
            <ViewerRoom
              key={room.id}
              room={room}
              cellSize={cellSize}
              isHovered={hoveredRoomId === room.id}
              onHover={() => setHoveredRoomId(room.id)}
              onLeave={() => setHoveredRoomId(null)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-info-500" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Waiting Room</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success-500" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Patient Room</span>
        </div>
      </div>
    </div>
  );
}
