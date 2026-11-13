import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Path } from 'react-native-svg';
import type { GeoPoint } from '../types';
import { colors, base } from '../theme';

/**
 * Lightweight map-like rendering of a plot's photo points and its convex
 * hull polygon. Pure SVG — no map tiles, so it works offline and on web.
 */
export function PlotMap({
  points,
  polygon,
  width = 300,
  height = 220,
}: {
  points: GeoPoint[];
  polygon?: GeoPoint[];
  width?: number;
  height?: number;
}) {
  const all = polygon ?? points;
  if (all.length === 0) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderRadius: 12 }}>
        <Text style={base.small}>No geo-tagged photos yet</Text>
      </View>
    );
  }

  const pad = 24;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Degenerate cases (single point or a straight line): expand range
  const latSpan = maxLat - minLat || 0.0005;
  const lngSpan = maxLng - minLng || 0.0005;

  const toXY = (p: GeoPoint) => {
    const x = pad + ((p.lng - minLng) / lngSpan) * (width - pad * 2);
    const y = pad + ((maxLat - p.lat) / latSpan) * (height - pad * 2);
    return [x, y] as const;
  };

  const polyPoints = (polygon ?? []).map((p) => toXY(p).join(',')).join(' ');
  const linePath = all.length >= 2
    ? all.map((p, i) => {
        const [x, y] = toXY(p);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : null;

  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: 12, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        {polygon && polygon.length >= 3 ? (
          <Polygon
            points={polyPoints}
            fill="rgba(185,123,74,0.25)"
            stroke={colors.accent}
            strokeWidth={2}
          />
        ) : null}
        {linePath ? <Path d={linePath} fill="none" stroke={colors.coffee} strokeWidth={1} strokeDasharray="4 4" /> : null}
        {points.map((p, i) => {
          const [x, y] = toXY(p);
          return (
            <Circle key={i} cx={x} cy={y} r={5} fill={colors.coffee} stroke="#fff" strokeWidth={1.5} />
          );
        })}
      </Svg>
    </View>
  );
}

export const plotMapStyles = StyleSheet.create({});
