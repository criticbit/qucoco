import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { colors, base, radius } from '../../src/theme';
import { Button, Card } from '../../src/components/ui';
import { PlotMap } from '../../src/components/PlotMap';
import { getCropPlot, plotShortId, getBeanLots, getBeverages, deleteCropPlot } from '../../src/lib/storage';
import type { CropPlot, BeanLot, Beverage, GeoPoint } from '../../src/types';
import { beverageTotal } from '../../src/types';
import { formatArea } from '../../src/lib/geo';

export default function PlotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plot, setPlot] = useState<CropPlot | null>(null);
  const [lots, setLots] = useState<BeanLot[]>([]);
  const [bevs, setBevs] = useState<Beverage[]>([]);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [p, allLots, allBevs] = await Promise.all([getCropPlot(id), getBeanLots(), getBeverages()]);
    setPlot(p);
    setLots(allLots.filter((l) => l.cropPlotId === id));
    setBevs(allBevs.filter((b) => b.beanLotId && allLots.some((l) => l.id === b.beanLotId && l.cropPlotId === id)));
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!plot) {
    return (
      <View style={styles.center}>
        <Text style={base.small}>Loading…</Text>
      </View>
    );
  }

  const geoPoints = plot.photos.filter((p) => p.locationSaved && p.geo).map((p) => p.geo!) as GeoPoint[];
  const shortId = plotShortId(plot);
  const url = `https://qucoco.app/plot/${shortId}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header + QR */}
      <Card style={styles.headCard}>
        <Text style={styles.title}>{plot.name}</Text>
        <View style={styles.headRow}>
          <QRCode value={url} size={120} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.shortId}>#{shortId}</Text>
            <Text style={base.small}>{url}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={() => Linking.openURL(url)}>
              <Ionicons name="link-outline" size={16} color={colors.coffee} />
              <Text style={styles.copyText}>Share reference</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* Map */}
      <Text style={base.label}>Plot map</Text>
      <PlotMap points={geoPoints} polygon={plot.polygon} />
      {plot.areaM2 && plot.areaM2 > 0 ? (
        <Text style={styles.areaText}>
          Area: {formatArea(plot.areaM2)} ({plot.polygon!.length} vertex hull)
        </Text>
      ) : (
        <Text style={styles.areaText}>
          {geoPoints.length < 3
            ? 'Add 3+ located photos to compute the area polygon.'
            : 'Photos are collinear — area is ~0.'}
        </Text>
      )}

      {/* Photos */}
      <Text style={base.label}>Photos ({plot.photos.length})</Text>
      <View style={styles.photoGrid}>
        {plot.photos.map((p) => (
          <View key={p.id} style={styles.photoCard}>
            <Image source={{ uri: p.imageUri }} style={styles.photoThumb} />
            <View style={styles.photoMeta}>
              <Ionicons
                name={p.locationSaved && p.geo ? 'location' : 'location-outline'}
                size={14}
                color={p.locationSaved && p.geo ? colors.accent : colors.textMuted}
              />
              <Text style={styles.photoMetaText}>
                {p.geo ? `${p.geo.lat.toFixed(4)}, ${p.geo.lng.toFixed(4)}` : 'no location'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Linked bean lots */}
      <Text style={base.label}>Linked bean lots ({lots.length})</Text>
      {lots.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={base.small}>No bean lots linked to this plot yet.</Text>
        </Card>
      ) : (
        lots.map((lot) => (
          <Card key={lot.id} style={styles.linkCard} onPress={() => router.push({ pathname: '/bean/[id]', params: { id: lot.id } })}>
            <Image source={{ uri: lot.imageUri }} style={styles.linkThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkName}>{lot.name}</Text>
              <Text style={base.small}>
                {lot.beanType} · {new Date(lot.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        ))
      )}

      {/* Linked beverages */}
      <Text style={base.label}>Beverages from these lots ({bevs.length})</Text>
      {bevs.map((bev) => (
        <Card key={bev.id} style={styles.linkCard} onPress={() => router.push({ pathname: '/beverage/[id]', params: { id: bev.id } })}>
          <Image source={{ uri: bev.imageUri }} style={styles.linkThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkName}>{bev.name}</Text>
            <Text style={base.small}>{bev.beverageType} · scored {beverageTotal(bev)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      ))}

      <Button
        label="Delete plot"
        variant="danger"
        onPress={() => {
          Alert.alert('Delete plot?', `This removes "${plot.name}" and unlinks its bean lots.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCropPlot(plot.id); router.back(); } },
          ]);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headCard: { gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  headRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  shortId: { fontSize: 18, fontWeight: '800', color: colors.accent },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyText: { color: colors.coffee, fontWeight: '600', fontSize: 13 },
  areaText: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  photoCard: { width: '48%' },
  photoThumb: { width: '100%', height: 110, borderRadius: radius, backgroundColor: colors.accentLight },
  photoMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoMetaText: { fontSize: 11, color: colors.textMuted, flex: 1 },
  emptyCard: { alignItems: 'center', paddingVertical: 16 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  linkThumb: { width: 48, height: 48, borderRadius: radius, backgroundColor: colors.accentLight },
  linkName: { fontSize: 15, fontWeight: '700', color: colors.text },
});
