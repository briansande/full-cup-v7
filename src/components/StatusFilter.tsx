'use client';
import React from 'react';

interface StatusFilterProps {
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
}

export default function StatusFilter({ statusFilter, setStatusFilter }: StatusFilterProps) {
  // Render the status filter
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <button
        onClick={() => setStatusFilter(null)}
        className={`cottage-button px-3 py-2 ${
          statusFilter === null 
            ? 'bg-[--cottage-primary] text-white border-[--cottage-primary]' 
            : 'hover:bg-[--cottage-secondary]/50'
        }`}
      >
        All
      </button>
      <button
        onClick={() => setStatusFilter("want_to_try")}
        className={`cottage-button px-3 py-2 ${
          statusFilter === "want_to_try" 
            ? 'bg-blue-500 text-white border-blue-500' 
            : 'hover:bg-blue-50'
        }`}
      >
        Want to Try
      </button>
      <button
        onClick={() => setStatusFilter("visited")}
        className={`cottage-button px-3 py-2 ${
          statusFilter === "visited" 
            ? 'bg-green-500 text-white border-green-500' 
            : 'hover:bg-green-50'
        }`}
      >
        Visited
      </button>
      <button
        onClick={() => setStatusFilter("favorite")}
        className={`cottage-button px-3 py-2 ${
          statusFilter === "favorite" 
            ? 'bg-red-500 text-white border-red-500' 
            : 'hover:bg-red-50'
        }`}
      >
        Favorites
      </button>
    </div>
  );
}