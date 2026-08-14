'use client';

import { useRef } from 'react';

/**
 * Circular angle picker — drag the needle (or use arrow keys) to set a direction.
 * File: src/app/dashboard/thumbnail-templates/components/AngleDial.tsx
 *
 * Angle convention matches the backend gradient: direction = (sin θ, cos θ) in
 * screen coords (x right, y down), so θ=0 points DOWN (top→bottom) and θ=90 points
 * RIGHT. Reading a pointer: θ = atan2(dx, dy). No external library — inline SVG.
 */
interface AngleDialProps {
  value: number; // degrees 0..359, clockwise from top→bottom
  onChange: (deg: number) => void;
  size?: number;
}

export function AngleDial({ value, onChange, size = 64 }: AngleDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const c = size / 2;
  const r = c - 6;
  const rad = (value * Math.PI) / 180;
  const tipX = c + Math.sin(rad) * r;
  const tipY = c + Math.cos(rad) * r;

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    if (dx === 0 && dy === 0) return;
    let deg = Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
    deg = ((deg % 360) + 360) % 360;
    onChange(deg);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) updateFromPointer(e.clientX, e.clientY);
  };
  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
    else return;
    e.preventDefault();
    onChange((value + delta + 360) % 360);
  };

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="slider"
      aria-label="그라데이션 각도"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={360}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className="cursor-pointer touch-none rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <circle cx={c} cy={c} r={r} className="fill-transparent stroke-gray-300" strokeWidth={2} />
      <line x1={c} y1={c} x2={tipX} y2={tipY} className="stroke-blue-600" strokeWidth={2} strokeLinecap="round" />
      <circle cx={tipX} cy={tipY} r={4} className="fill-blue-600" />
      <circle cx={c} cy={c} r={2.5} className="fill-gray-400" />
    </svg>
  );
}
