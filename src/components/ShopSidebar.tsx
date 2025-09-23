'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shop } from '@/src/types/shop';
import Link from 'next/link';

interface ShopSidebarProps {
  shops: Shop[];
  onShopSelect: (shop: Shop) => void;
  isVisible: boolean;
  onToggle: () => void;
  selectedShopId?: string | null;
}

export default function ShopSidebar({ shops, onShopSelect, isVisible, onToggle, selectedShopId }: ShopSidebarProps) {
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const selectedShopRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Create a callback ref to handle the selected shop element
  const getShopRef = (shopId: string) => (element: HTMLDivElement) => {
    if (shopId === selectedShopId && element) {
      selectedShopRef.current = element;
    }
  };
  
  // Update expanded shop when selectedShopId changes (e.g., from map marker click)
  useEffect(() => {
    if (selectedShopId) {
      setExpandedShopId(selectedShopId);
    }
  }, [selectedShopId]);
  
  // Auto-scroll to selected shop when it changes
  useEffect(() => {
    if (selectedShopId && selectedShopRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = selectedShopRef.current;
      
      // Calculate the position of the selected element relative to the container
      const containerRect = container.getBoundingClientRect();
      const elementRect = selectedElement.getBoundingClientRect();
      
      // Calculate the scroll position needed to center the element
      const scrollTop = selectedElement.offsetTop - container.offsetTop - (containerRect.height / 2) + (elementRect.height / 2);
      
      // Scroll to the calculated position with smooth behavior
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }, [selectedShopId]);

  const toggleExpand = (shopId: string) => {
    setExpandedShopId(expandedShopId === shopId ? null : shopId);
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-1/2 right-0 z-[1200] bg-white shadow-lg rounded-l-xl p-3 transform -translate-y-1/2 hover:bg-[--cottage-secondary] transition-all duration-200"
        aria-label="Show shop list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[--cottage-primary]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-0 h-full z-[1100] bg-white shadow-xl flex flex-col w-80 cottage-map-container">
      {/* Sidebar header */}
      <div className="p-4 border-b border-[--cottage-neutral-light] flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[--cottage-primary]">Coffee Shops ({shops.length})</h2>
        <button
          onClick={onToggle}
          className="p-2 rounded-full hover:bg-[--cottage-secondary] transition-colors"
          aria-label="Hide shop list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[--cottage-neutral-dark]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable shop list */}
      <div ref={scrollContainerRef} className="overflow-y-auto flex-grow">
        {shops.length === 0 ? (
          <div className="p-6 text-center text-[--cottage-neutral-dark]/70">
            No coffee shops found in the current view
          </div>
        ) : (
          <ul>
            {shops.map((shop) => (
              <li key={shop.id} className="border-b border-[--cottage-neutral-light] last:border-b-0">
                <div
                  ref={getShopRef(shop.id)}
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    expandedShopId === shop.id ? 'bg-[--cottage-secondary]' : 'hover:bg-[--cottage-secondary]/50'
                  } ${
                    selectedShopId === shop.id ? 'bg-[--cottage-accent]/10 border-l-4 border-[--cottage-accent]' : ''
                  }`}
                  onClick={() => {
                    toggleExpand(shop.id);
                    onShopSelect(shop);
                  }}
                >
                  {/* Shop name and rating */}
                  <div className="flex justify-between items-start">
                    <h3 className={`font-medium ${selectedShopId === shop.id ? 'text-[--cottage-primary]' : 'text-[--cottage-neutral-dark]'}`}>{shop.name || 'Unnamed shop'}</h3>
                    {shop.avgRating != null && (
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1">★</span>
                        <span className="text-[--cottage-neutral-dark]">{Number(shop.avgRating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedShopId === shop.id && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm text-[--cottage-neutral-dark]/80">
                        {shop.avgCoffeeQuality != null && (
                          <div>Coffee: <span className="text-[--cottage-accent] font-medium">{Number(shop.avgCoffeeQuality).toFixed(1)} ★</span></div>
                        )}
                        {shop.avgAtmosphere != null && (
                          <div>Atmosphere: <span className="text-[--cottage-accent] font-medium">{Number(shop.avgAtmosphere).toFixed(1)} ★</span></div>
                        )}
                        {shop.avgWifiQuality != null && (
                          <div>WiFi: <span className="text-[--cottage-accent] font-medium">{Number(shop.avgWifiQuality).toFixed(1)} ★</span></div>
                        )}
                      </div>
                      <div className="pt-2">
                        <Link
                          href={`/shop/${shop.id}`}
                          className="text-[--cottage-primary] hover:text-[--cottage-terracotta] text-sm font-medium transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}