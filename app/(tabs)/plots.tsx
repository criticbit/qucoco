import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, base, radius } from '../../src/theme';
import { Button, Card, ModalSheet, Field, Chip } from '../../src/components/ui';
import { getCropPlots, saveCropPlot, genId, deleteCropPlot, plotShortId } from '../../src/lib/storage';
import type { CropPlot, PlotPhoto } from '../../src/types';
import { extractGeoFromImage, convexHull, polygonAreaM2, polygonCenter, formatArea } from '../../src/lib/geo';

export default function PlotsScreen() {
  const router = useRouter();
  const [plots, setPlots] = useState<CropPlot[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<PlotPhoto[]>([]);
  const [locDefault, setLocDefault] = useState(true);
  const [computing, setComputing] = useState(false);

  const refresh = useCallback(async () => {
    setPlots(await getCropPlots());
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function addPhotos() {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const geo = locDefault ? (await extractGeoFromImage(asset.uri)) ?? undefined : undefined;
    setPhotos((prev) => [
      ...prev,
      {
        id: genId(),
        imageUri: asset.uri,
        takenAt: Date.now(),
        geo,
        locationSaved: locDefault && !!geo,
      },
    ]);
  }

  async function computeAndSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this plot a name.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('No photos', 'Add at least one photo of the plot.');
      return;
    }
    setComputing(true);
    const geoPoints = photos
      .filter((p) => p.locationSaved && p.geo)
      .map((p) => p.geo!);
    const polygon = geoPoints.length >= 3 ? convexHull(geoPoints) : undefined;
    const areaM2 = polygon ? polygonAreaM2(polygon) : undefined;
    const center = geoPoints.length ? polygonCenter(geoPoints) : undefined;

    const plot: CropPlot = {
      id: genId(),
      createdAt: Date.now(),
      name: name.trim(),
      photos,
      polygon,
      areaM2,
      center,
    };
    await saveCropPlot(plot);
    setComputing(false);
    closeAdd();
    refresh();
  }

  function closeAdd() {
    setAdding(false);
    setName('');
    setPhotos([]);
    setLocDefault(true);
  }

  async function onDelete(plot: CropPlot) {
    Alert.alert('Delete plot?', `This removes "${plot.name}" and unlinks its bean lots.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCropPlot(plot.id); refresh(); } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>
          {plots.length} plot{plots.length === 1 ? '' : 's'}
        </Text>
        <Button label="New plot" onPress={() => setAdding(true)} />
      </View>

      {plots.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="map-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            No plots yet. Capture photos of your growing plot to map its area and
            link it to bean lots.
          </Text>
        </Card>
      ) : (
        plots.map((plot) => {
          const first = plot.photos[0];
          const hasArea = !!plot.areaM2 && plot.areaM2 > 0;
          return (
            <TouchableOpacity key={plot.id} style={styles.itemWrap} onPress={() => router.push({ pathname: '/plot/[id]', params: { id: plot.id } })}>
              <Card style={styles.item}>
                <View style={styles.itemRow}>
                  {first ? (
                    <Image source={{ uri: first.imageUri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{plot.name}</Text>
                    <Text style={styles.itemMeta}>
                      {plot.photos.length} photo{plot.photos.length === 1 ? '' : 's'}
                      {hasArea ? ` · ${formatArea(plot.areaM2!)}` : ''}
                      {plot.center ? ' · located' : ''}
                    </Text>
                    <Text style={styles.shortId}>#{plotShortId(plot)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => onDelete(plot)} style={styles.delBtn}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })
      )}

      <ModalSheet
        visible={adding}
        title="New crop plot"
        onClose={closeAdd}
      >
        <Field label="Plot name" value={name} onChangeText={setName} placeholder="e.g. North slope" />
        <Text style={base.label}>Photos</Text>
        <Button label="Capture photo" variant="secondary" onPress={addPhotos} />
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((p) => (
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
          </ScrollView>
        )}
        <Chip label="Save GPS location" active={locDefault} onPress={() => setLocDefault((v) => !v)} />
        <Text style={[base.small, { marginBottom: 12 }]}>
          Photos are geo-tagged from EXIF automatically. With 3+ located photos,
          the plot's area polygon is computed.
        </Text>
        <Button label={computing ? 'Saving…' : 'Save plot'} disabled={computing} onPress={computeAndSave} />
      </ModalSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { ...base.small, textAlign: 'center' },
  itemWrap: { marginBottom: 12 },
  item: {},
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius, backgroundColor: colors.accentLight },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  shortId: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 2 },
  delBtn: { padding: 8 },
  photoRow: { marginBottom: 12 },
  photoCard: { width: 120, marginRight: 8 },
  photoThumb: { width: 120, height: 90, borderRadius: radius, backgroundColor: colors.accentLight },
  photoMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoMetaText: { fontSize: 11, color: colors.textMuted, flex: 1 },
});
