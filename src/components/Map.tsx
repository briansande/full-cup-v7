'use client';
import React from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer } from 'react-leaflet';

export default function Map() {
  const position: [number, number] = [29.7604, -95.3698];

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer
        center={position}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}