'use client';

import React, { useState } from 'react';
import { Shop } from '@/src/types/shop';
import Link from 'next/link';

interface ShopSidebarProps {
  shops: Shop[];
  onShopSelect: (shop: Shop) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export default function ShopSidebar({ shops, onShopSelect, isVisible, onToggle }: ShopSidebarProps) {
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);

  const toggleExpand = (shopId: string) => {
    setExpandedShopId(expandedShopId === shopId ? null : shopId);
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-1/2 left-0 z-[1200] bg-white shadow-lg rounded-r-lg p-2 transform -translate-y-1/2 hover:bg-gray-100 transition-all"
        aria-label="Show shop list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 h-full z-[1100] bg-white shadow-lg flex flex-col w-80">
      {/* Sidebar header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Coffee Shops ({shops.length})</h2>
        <button 
          onClick={onToggle}
          className="p-1 rounded-full hover:bg-gray-100"
          aria-label="Hide shop list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable shop list */}
      <div className="overflow-y-auto flex-grow">
        {shops.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No coffee shops found in the current view
          </div>
        ) : (
          <ul>
            {shops.map((shop) => (
              <li key={shop.id} className="border-b last:border-b-0">
                <div 
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${expandedShopId === shop.id ? 'bg-gray-50' : ''}`}
                  onClick={() => {
                    toggleExpand(shop.id);
                    onShopSelect(shop);
                  }}
                >
                  {/* Shop name and rating */}
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium">{shop.name || 'Unnamed shop'}</h3>
                    {shop.avgRating !== null && (
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1">★</span>
                        <span>{shop.avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedShopId === shop.id && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm text-gray-600">
                        {shop.avgCoffeeQuality !== null && (
                          <div>Coffee: {shop.avgCoffeeQuality.toFixed(1)} ★</div>
                        )}
                        {shop.avgAtmosphere !== null && (
                          <div>Atmosphere: {shop.avgAtmosphere.toFixed(1)} ★</div>
                        )}
                        {shop.avgWifiQuality !== null && (
                          <div>WiFi: {shop.avgWifiQuality.toFixed(1)} ★</div>
                        )}
                      </div>
                      <div className="pt-2">
                        <Link 
                          href={`/shop/${shop.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Details
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