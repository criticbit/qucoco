import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import type { BeanLot, BeanType } from '../../src/types';
import { getBeanLots, saveBeanLot, deleteBeanLot, genId, getCropPlots } from '../../src/lib/storage';
import type { CropPlot } from '../../src/types';
import { analyzeBeanPhoto } from '../../src/lib/analysis';
import { Card, Button, ScoreDial, StatBar, Chip, ModalSheet, Field } from '../../src/components/ui';
import { base, colors } from '../../src/theme';

export default function BeansScreen() {
  const router = useRouter();
  const [lots, setLots] = useState<BeanLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [beanType, setBeanType] = useState<BeanType>('green');
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [notes, setNotes] = useState('');
  const [cropPlotId, setCropPlotId] = useState<string | undefined>(undefined);
  const [plots, setPlots] = useState<CropPlot[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([getBeanLots(), getCropPlots()]);
      setLots(l);
      setPlots(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickPhoto() {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;
    setPicking(false);
    setPickedUri(result.assets![0].uri);
  }

  async function chooseFromFile() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;
    setPickedUri(result.assets![0].uri);
  }

  async function confirmAndSave() {
    if (!pickedUri) return;
    setAnalyzing(true);
    setError(null);
    try {
      const analysis = await analyzeBeanPhoto(pickedUri, beanType);
      const lot: BeanLot = {
        id: genId(),
        createdAt: Date.now(),
        name: name.trim() || `${beanType} lot ${new Date().toLocaleDateString()}`,
        imageUri: pickedUri,
        beanType,
        analysis,
        origin: origin.trim() || undefined,
        notes: notes.trim() || undefined,
        cropPlotId: cropPlotId || undefined,
      };
      await saveBeanLot(lot);
      resetForm();
      await load();
      router.push(`/bean/${lot.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  function resetForm() {
    setSheetOpen(false);
    setPickedUri(null);
    setName('');
    setOrigin('');
    setNotes('');
    setCropPlotId(undefined);
    setError(null);
  }

  function confirmDelete(lot: BeanLot) {
    Alert.alert('Delete lot', `Delete "${lot.name}" and unlink its beverages?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBeanLot(lot.id);
          load();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={base.screen}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.coffee} />
      }
    >
      <Text style={base.title}>Bean Lots</Text>
      <Text style={base.subtitle}>
        Photograph green or roasted beans — QuCoCo analyzes color, uniformity and roast level.
      </Text>

      <Button label="+ New bean analysis" onPress={() => setSheetOpen(true)} />

      <View style={{ paddingBottom: 24 }}>
        {lots.length === 0 && !loading && (
          <Text style={[base.small, { marginTop: 24, textAlign: 'center' }]}>
            No bean lots yet. Take a photo to get started.
          </Text>
        )}
        {lots.map((lot) => (
          <Card key={lot.id} style={{ marginBottom: 12 }} onPress={() => router.push(`/bean/${lot.id}`)}>
            <View style={{ flexDirection: 'row' }}>
              <Image
                source={{ uri: lot.imageUri }}
                style={{ width: 72, height: 72, borderRadius: 10, marginRight: 12, backgroundColor: colors.bg }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{lot.name}</Text>
                <Text style={[base.small, { marginTop: 2 }]}>
                  {lot.beanType === 'green' ? 'Green beans' : `Roasted · ${lot.analysis.roastLevel}`}
                  {lot.origin ? ` · ${lot.origin}` : ''}
                </Text>
                <Text style={[base.small, { marginTop: 2 }]}>
                  {new Date(lot.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <ScoreDial value={lot.analysis.score} size={64} />
            </View>
          </Card>
        ))}
      </View>

      <ModalSheet visible={sheetOpen} onClose={resetForm} title="New bean analysis">
        {!pickedUri ? (
          <>
            <Text style={[base.label, { marginTop: 6 }]}>Bean type</Text>
            <View>
              <Chip active={beanType === 'green'} label="Green beans" onPress={() => setBeanType('green')} />
              <Chip active={beanType === 'roasted'} label="Roasted beans" onPress={() => setBeanType('roasted')} />
            </View>
            <Text style={[base.small, { marginBottom: 12 }]}>
              Tip: lay the beans out evenly on a neutral surface and fill the center of the frame.
            </Text>
            {picking ? (
              <Text style={base.small}>Starting camera…</Text>
            ) : (
              <>
                <Button
                  label="Take photo"
                  onPress={async () => {
                    setPicking(true);
                    await pickPhoto();
                  }}
                />
                <Button label="Choose from library" variant="secondary" onPress={chooseFromFile} />
              </>
            )}
          </>
        ) : (
          <>
            <Image
              source={{ uri: pickedUri }}
              style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: colors.bg }}
              resizeMode="cover"
            />
            <View>
              <Chip active={beanType === 'green'} label="Green" onPress={() => setBeanType('green')} />
              <Chip active={beanType === 'roasted'} label="Roasted" onPress={() => setBeanType('roasted')} />
            </View>
            <Field label="Lot name" value={name} onChangeText={setName} placeholder="e.g. Ethiopia Yirgacheffe batch 12" />
            <Field label="Origin (optional)" value={origin} onChangeText={setOrigin} placeholder="Farm, region, country" />
            {plots.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[base.label, { marginBottom: 6 }]}>Crop plot (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {plots.map((p) => (
                    <Chip
                      key={p.id}
                      active={cropPlotId === p.id}
                      label={p.name}
                      onPress={() => setCropPlotId((cur) => (cur === p.id ? undefined : p.id))}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
            <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Drying method, grade, defects seen…" />
            {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
            <Button label={analyzing ? 'Analyzing…' : 'Analyze & save'} disabled={analyzing} onPress={confirmAndSave} />
            <Button label="Retake photo" variant="secondary" onPress={() => setPickedUri(null)} />
          </>
        )}
      </ModalSheet>
    </ScrollView>
  );
}
