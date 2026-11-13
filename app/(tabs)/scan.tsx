import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { BeanType } from '../../src/types';
import { getBeanLots } from '../../src/lib/storage';
import { analyzeBeanPhoto } from '../../src/lib/analysis';
import { Button, Chip, ScoreDial, StatBar, TastingSlider, ModalSheet, Field } from '../../src/components/ui';
import { base, colors } from '../../src/theme';
import type { BeanLot, BeverageType } from '../../src/types';
import { saveBeanLot, saveBeverage, genId } from '../../src/lib/storage';

type Mode = 'bean' | 'beverage';

const BEVERAGE_TYPES: { id: BeverageType; label: string }[] = [
  { id: 'espresso', label: 'Espresso' },
  { id: 'filter', label: 'Filter' },
  { id: 'milk', label: 'Milk drink' },
  { id: 'other', label: 'Other' },
];

export default function ScanScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('bean');
  const [uri, setUri] = useState<string | null>(null);
  const [beanType, setBeanType] = useState<BeanType>('green');
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // beverage state
  const [bevType, setBevType] = useState<BeverageType>('espresso');
  const [scores, setScores] = useState({ aroma: 7, acidity: 7, body: 7, sweetness: 7, balance: 7 });
  const [beanLots, setBeanLots] = useState<BeanLot[]>([]);
  const [linkedLotId, setLinkedLotId] = useState<string | undefined>(undefined);
  const [linkSheet, setLinkSheet] = useState(false);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeBeanPhoto>> | null>(null);

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    setError(null);
    setDone(false);
    setUri(result.assets![0].uri);
    if (mode === 'bean') await runBeanAnalysis(result.assets![0].uri, beanType);
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;
    setError(null);
    setDone(false);
    setUri(result.assets![0].uri);
    if (mode === 'bean') await runBeanAnalysis(result.assets![0].uri, beanType);
  }

  async function runBeanAnalysis(imageUri: string, type: BeanType) {
    try {
      setBusy(true);
      const result = await analyzeBeanPhoto(imageUri, type);
      setAnalysis(result);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setBusy(false);
    }
  }


  async function saveBean() {
    if (!uri || !analysis) return;
    setBusy(true);
    try {
      const lot = {
        id: genId(),
        createdAt: Date.now(),
        name: name.trim() || `${beanType} lot ${new Date().toLocaleDateString()}`,
        imageUri: uri,
        beanType,
        analysis,
        origin: origin.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await saveBeanLot(lot);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  async function openLinkPicker() {
    setBeanLots(await getBeanLots());
    setLinkSheet(true);
  }

  async function submitBeverage() {
    if (!uri) return;
    setBusy(true);
    try {
      const bev = {
        id: genId(),
        createdAt: Date.now(),
        name: name.trim() || `${BEVERAGE_TYPES.find((t) => t.id === bevType)?.label ?? 'Beverage'} ${new Date().toLocaleDateString()}`,
        imageUri: uri,
        beverageType: bevType,
        scores,
        beanLotId: linkedLotId,
        notes: notes.trim() || undefined,
      };
      await saveBeverage(bev);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setUri(null);
    setAnalysis(null);
    setName('');
    setOrigin('');
    setNotes('');
    setLinkedLotId(undefined);
    setScores({ aroma: 7, acidity: 7, body: 7, sweetness: 7, balance: 7 });
    setError(null);
    setDone(false);
  }

  if (done) {
    return (
      <View style={[base.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ScoreDial
          value={
            mode === 'bean'
              ? analysis!.score
              : Math.round((scores.aroma + scores.acidity + scores.body + scores.sweetness + scores.balance) / 5 * 10)
          }
        />
        <Text style={[base.title, { marginTop: 16, textAlign: 'center' }]}>Saved!</Text>
        <Text style={[base.small, { marginBottom: 8, textAlign: 'center' }]}>
          {mode === 'bean' ? 'Bean lot stored' : 'Beverage evaluation stored'}
        </Text>
        <Button label="Scan another" onPress={reset} />
        <Button
          label="Go to records"
          variant="secondary"
          onPress={() => router.navigate(mode === 'bean' ? '/(tabs)/beans' : '/(tabs)/beverages')}
        />
      </View>
    );
  }

  return (
    <ScrollView style={base.screen}>
      <Text style={base.title}>Analyze</Text>
      <Text style={base.subtitle}>What are you inspecting?</Text>

      {!uri ? (
        <>
          <View>
            <Chip active={mode === 'bean'} label="Coffee beans" onPress={() => { setMode('bean'); }} />
            <Chip active={mode === 'beverage'} label="Beverage" onPress={() => { setMode('beverage'); }} />
          </View>
          {mode === 'bean' ? (
            <>
              <View style={{ marginTop: 12 }}>
                <Chip active={beanType === 'green'} label="Green beans" onPress={() => setBeanType('green')} />
                <Chip active={beanType === 'roasted'} label="Roasted beans" onPress={() => setBeanType('roasted')} />
              </View>
              <Text style={[base.small, { marginTop: 10, marginBottom: 8 }]}>
                {beanType === 'green'
                  ? 'Green: lay beans on a neutral surface, even lighting, fill the center of the frame.'
                  : 'Roasted: spread beans evenly; QuCoCo will estimate roast level from color.'}
              </Text>
            </>
          ) : (
            <>
              <View style={{ marginTop: 12 }}>
                {BEVERAGE_TYPES.map((t) => (
                  <Chip key={t.id} active={bevType === t.id} label={t.label} onPress={() => setBevType(t.id)} />
                ))}
              </View>
              <Text style={[base.small, { marginTop: 10, marginBottom: 8 }]}>
                Photograph the cup from slightly above so the surface (crema / color) is visible.
              </Text>
            </>
          )}
          <Button label="Take photo" onPress={takePhoto} />
          <Button label="Choose from library" variant="secondary" onPress={fromLibrary} />
        </>
      ) : (
        <>
          <Image
            source={{ uri: uri }}
            style={{ width: '100%', height: 220, borderRadius: 14, marginBottom: 14, backgroundColor: colors.bg }}
            resizeMode="cover"
          />
          {mode === 'bean' ? (
            <>
              <View>
                <Chip active={beanType === 'green'} label="Green" onPress={() => { setBeanType('green'); if (uri) runBeanAnalysis(uri, 'green'); }} />
                <Chip active={beanType === 'roasted'} label="Roasted" onPress={() => { setBeanType('roasted'); if (uri) runBeanAnalysis(uri, 'roasted'); }} />
              </View>
              {busy && <Text style={base.small}>Analyzing pixels…</Text>}
              {!busy && analysis && (
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <ScoreDial value={analysis.score} />
                  {beanType === 'roasted' && analysis.roastLevel && (
                    <Text style={{ fontWeight: '700', color: colors.coffee, marginTop: 10 }}>
                      Estimated roast: {analysis.roastLevel}
                    </Text>
                  )}
                </View>
              )}
              {!busy && analysis && (
                <View style={{ marginBottom: 12 }}>
                  <StatBar label="Type match" value={analysis.typeMatch} />
                  <StatBar label="Color uniformity" value={analysis.uniformity} />
                  {beanType === 'roasted' && <StatBar label="Roast intensity" value={analysis.roastIntensity ?? 0} />}
                </View>
              )}
              {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
              <Field label="Lot name" value={name} onChangeText={setName} placeholder="e.g. Batch 12 — natural process" />
              <Field label="Origin (optional)" value={origin} onChangeText={setOrigin} />
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
              {!busy && analysis && <Button label="Save bean lot" onPress={saveBean} />}
              <Button label="Retake photo" variant="secondary" onPress={reset} />
            </>
          ) : (
            <>
              <Field label="Cup name" value={name} onChangeText={setName} placeholder="e.g. V60 — Ethiopia washed" />
              <Text style={base.label}>Tasting notes (0–10 each)</Text>
              <TastingSlider label="Aroma" value={scores.aroma} onChange={(v) => setScores({ ...scores, aroma: v })} />
              <TastingSlider label="Acidity" value={scores.acidity} onChange={(v) => setScores({ ...scores, acidity: v })} />
              <TastingSlider label="Body" value={scores.body} onChange={(v) => setScores({ ...scores, body: v })} />
              <TastingSlider label="Sweetness" value={scores.sweetness} onChange={(v) => setScores({ ...scores, sweetness: v })} />
              <TastingSlider label="Balance" value={scores.balance} onChange={(v) => setScores({ ...scores, balance: v })} />
              <Button label="Link to a bean lot" variant="secondary" onPress={openLinkPicker} />
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
              <Button label="Save evaluation" onPress={submitBeverage} />
              <Button label="Retake photo" variant="secondary" onPress={reset} />
            </>
          )}
        </>
      )}

      <ModalSheet visible={linkSheet} onClose={() => setLinkSheet(false)} title="Link bean lot">
        {beanLots.length === 0 ? (
          <Text style={base.small}>No bean lots yet — analyze some beans first.</Text>
        ) : (
          beanLots.map((lot) => (
            <Chip
              key={lot.id}
              active={linkedLotId === lot.id}
              label={lot.name}
              onPress={() => {
                setLinkedLotId(lot.id);
                setLinkSheet(false);
              }}
            />
          ))
        )}
      </ModalSheet>
    </ScrollView>
  );
}
