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
             ? 'cottage-button-primary shadow-md' 
             : 'hover:bg-[--cottage-secondary]/50'
         }`}
       >
         All
       </button>
       <button
         onClick={() => setStatusFilter("want_to_try")}
         className={`cottage-button px-3 py-2 ${
           statusFilter === "want_to_try" 
             ? 'bg-[#CC7357] text-white border-[#CC7357] shadow-md' 
             : 'hover:bg-[--cottage-terracotta]/20'
         }`}
       >
         Want to Try
       </button>
       <button
         onClick={() => setStatusFilter("visited")}
         className={`cottage-button px-3 py-2 ${
           statusFilter === "visited" 
             ? 'bg-[#8FBC8F] text-white border-[#8FBC8F] shadow-md' 
             : 'hover:bg-[--cottage-success]/20'
         }`}
       >
         Visited
       </button>
       <button
         onClick={() => setStatusFilter("favorite")}
         className={`cottage-button px-3 py-2 ${
           statusFilter === "favorite" 
             ? 'bg-[#D2691E] text-white border-[#D2691E] shadow-md' 
             : 'hover:bg-[--cottage-warning]/20'
         }`}
       >
         Favorites
       </button>
     </div>
  );
}