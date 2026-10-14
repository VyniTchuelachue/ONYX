'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '@onyx/core';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

export interface MapMarker {
  id: string;
  point: GeoPoint;
  kind: 'technician' | 'driver' | 'live';
  label?: string;
  available?: boolean;
}

/**
 * Leaflet over raster tiles: light enough for mid-range phones on mobile data.
 * Load it with next/dynamic and `ssr: false`.
 */
export default function OnyxMap({
  center,
  zoom = 13,
  markers,
  selectedId,
  onSelect,
  fit = false,
  className,
  label,
}: {
  center: GeoPoint;
  zoom?: number;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Zoom to show every marker instead of using `zoom`. */
  fit?: boolean;
  className?: string;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    L.tileLayer(config.map.tileUrl, { attribution: config.map.attribution, maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const mk of markers) {
      const selected = mk.id === selectedId;
      const html =
        mk.kind === 'driver'
          ? '<span class="onyx-pin onyx-pin--driver"><i></i></span>'
          : mk.kind === 'live'
            ? '<span class="onyx-pin onyx-pin--live"><i></i></span>'
            : `<span class="onyx-pin onyx-pin--tech${mk.available ? ' is-available' : ''}${selected ? ' is-selected' : ''}"><i></i></span>`;
      const size = mk.kind === 'technician' ? (selected ? 30 : 22) : 22;
      const marker = L.marker([mk.point.lat, mk.point.lng], {
        icon: L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        title: mk.label,
        keyboard: mk.kind === 'technician',
        zIndexOffset: mk.kind === 'technician' ? (selected ? 1000 : 0) : 500,
      });
      if (mk.kind === 'technician') marker.on('click', () => onSelectRef.current?.(mk.id));
      marker.addTo(group);
    }
  }, [markers, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (fit && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((mk) => [mk.point.lat, mk.point.lng] as [number, number]));
      m.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    } else {
      m.setView([center.lat, center.lng], m.getZoom() || zoom, { animate: true });
    }
    // Re-centre only when the centre itself moves, not on every marker refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, fit]);

  useEffect(() => {
    const m = map.current;
    const target = markers.find((mk) => mk.id === selectedId);
    if (m && target) m.panTo([target.point.lat, target.point.lng], { animate: true });
  }, [selectedId, markers]);

  return <div ref={el} role="region" aria-label={label} className={cn('isolate z-0 h-full w-full', config.map.darken && 'onyx-map--darken', className)} />;
}
