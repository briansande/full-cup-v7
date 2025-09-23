'use client';
import React from 'react';
import FilterControls from './FilterControls';

interface MapFilterControlsProps {
  isLeftSidebarVisible: boolean;
  toggleLeftSidebar: () => void;
  filterChildren: React.ReactNode;
}

export default function MapFilterControls({
  isLeftSidebarVisible,
  toggleLeftSidebar,
  filterChildren
}: MapFilterControlsProps) {
  // Render the map filter controls
  return (
    <>
      {isLeftSidebarVisible && (
        <div className="absolute left-0 top-0 h-full z-[1100] bg-white shadow-lg flex flex-col w-80 cottage-map-container">
          <div className="p-4 border-b border-[--cottage-neutral-light] flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[--cottage-primary]">Filters</h2>
            <button
              onClick={toggleLeftSidebar}
              className="p-2 rounded-full hover:bg-[--cottage-secondary] transition-colors"
              aria-label="Collapse filter panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[--cottage-neutral-dark]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-grow p-4">
            {filterChildren}
          </div>
        </div>
      )}

      {/* Collapse/Expand Button - positioned at midpoint of sidebar */}
      <button
        onClick={toggleLeftSidebar}
        className="absolute top-1/2 z-[1200] bg-white shadow-lg rounded-r-xl p-3 transform -translate-y-1/2 hover:bg-[--cottage-secondary] transition-all duration-200 border-l border-t border-b border-[--cottage-neutral-light]"
        aria-label={isLeftSidebarVisible ? "Collapse filter panel" : "Expand filter panel"}
        style={{ left: isLeftSidebarVisible ? '20rem' : '0' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[--cottage-primary]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLeftSidebarVisible ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
        </svg>
      </button>
    </>
  );
}