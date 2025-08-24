import React from "react";

export default function Home() {
  return (
    <div className="fullcup-hero">
      <div className="fullcup-card">
        <h1 className="text-4xl sm:text-6xl fullcup-title">Full Cup</h1>
        <p className="mt-3 text-base sm:text-xl fullcup-subtitle">
          Houston Coffee Shop Discovery
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 justify-center">
          <button className="px-5 py-2 rounded-full bg-[var(--coffee-brown)] text-[var(--cream)] font-semibold shadow-sm">
            Browse Coffee Shops
          </button>
          <button className="px-5 py-2 rounded-full border border-[rgba(59,47,47,0.12)] text-sm">
            About Full Cup
          </button>
        </div>
      </div>
    </div>
  );
}
