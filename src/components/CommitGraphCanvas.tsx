import React, { useEffect, useRef } from 'react';
import type { CommitInfo, Theme } from '../types';

interface CommitGraphCanvasProps {
  commits: CommitInfo[];
  selectedSha: string | null;
  theme: Theme;
  rowHeight?: number;
  laneWidth?: number;
}

interface LaneNode {
  sha: string;
  lane: number;
  parents: string[];
}

const LANE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

export const CommitGraphCanvas: React.FC<CommitGraphCanvasProps> = ({
  commits,
  selectedSha,
  theme,
  rowHeight = 38,
  laneWidth = 18,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || commits.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine lane assignments using simple topological tracking
    const activeLanes: (string | null)[] = [];
    const nodes: LaneNode[] = [];

    for (const c of commits) {
      // Find if this commit is already in an active lane (from child's parent reference)
      let assignedLane = activeLanes.indexOf(c.sha);
      if (assignedLane === -1) {
        // Find first empty slot
        assignedLane = activeLanes.indexOf(null);
        if (assignedLane === -1) {
          assignedLane = activeLanes.length;
          activeLanes.push(c.sha);
        } else {
          activeLanes[assignedLane] = c.sha;
        }
      }

      // Record assigned lane
      nodes.push({
        sha: c.sha,
        lane: assignedLane,
        parents: c.parents,
      });

      // Update active lanes with parents
      if (c.parents.length > 0) {
        // First parent stays in the current lane
        activeLanes[assignedLane] = c.parents[0];

        // Additional parents (merge) occupy next available lanes
        for (let i = 1; i < c.parents.length; i++) {
          const p = c.parents[i];
          if (!activeLanes.includes(p)) {
            const emptyIdx = activeLanes.indexOf(null);
            if (emptyIdx === -1) {
              activeLanes.push(p);
            } else {
              activeLanes[emptyIdx] = p;
            }
          }
        }
      } else {
        // Root commit: free up this lane
        activeLanes[assignedLane] = null;
      }
    }

    const maxLane = Math.max(...nodes.map((n) => n.lane), 0);
    const canvasWidth = Math.max((maxLane + 2) * laneWidth, 60);
    const canvasHeight = commits.length * rowHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw connections between commits
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const fromX = (node.lane + 1) * laneWidth;
      const fromY = i * rowHeight + rowHeight / 2;
      const color = LANE_COLORS[node.lane % LANE_COLORS.length];

      for (let pIdx = 0; pIdx < node.parents.length; pIdx++) {
        const parentSha = node.parents[pIdx];
        const parentIndex = nodes.findIndex((n) => n.sha === parentSha);

        if (parentIndex !== -1) {
          const parentNode = nodes[parentIndex];
          const toX = (parentNode.lane + 1) * laneWidth;
          const toY = parentIndex * rowHeight + rowHeight / 2;

          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (fromX === toX) {
            // Straight vertical line
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
          } else {
            // Smooth bezier curve for branching or merging
            const midY = (fromY + toY) / 2;
            ctx.moveTo(fromX, fromY);
            ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
          }
          ctx.stroke();
        } else {
          // Parent not in current batch, draw short stub downwards
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(fromX, fromY + rowHeight * 0.75);
          ctx.stroke();
        }
      }
    }

    // Draw commit dots
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const x = (node.lane + 1) * laneWidth;
      const y = i * rowHeight + rowHeight / 2;
      const isSelected = node.sha === selectedSha;
      const isMerge = node.parents.length > 1;
      const color = LANE_COLORS[node.lane % LANE_COLORS.length];

      // Glow effect if selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color + '44';
        ctx.fill();
      }

      // Outer ring / fill
      ctx.beginPath();
      ctx.arc(x, y, isMerge ? 4.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = theme === 'dark' ? '#18181b' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      if (isMerge) {
        // Inner bullseye dot for merge commit
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }, [commits, selectedSha, theme, rowHeight, laneWidth]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none shrink-0" style={{ minWidth: '40px' }} />
  );
};
