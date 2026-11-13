import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import type { BeanLot, Beverage } from '../../src/types';
import { beverageTotal } from '../../src/types';
import { getBeverages, getBeanLots, deleteBeverage } from '../../src/lib/storage';
import { Card, Button, ScoreDial, TastingSlider } from '../../src/components/ui';
import { base, colors } from '../../src/theme';

export default function BeverageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [bev, setBev] = useState<Beverage | null>(null);
  const [lot, setLot] = useState<BeanLot | null>(null);

  useEffect(() => {
    (async () => {
      const bevs = await getBeverages();
      const b = bevs.find((x) => x.id === id) ?? null;
      setBev(b);
      if (b?.beanLotId) {
        const lots = await getBeanLots();
        setLot(lots.find((l) => l.id === b.beanLotId) ?? null);
      }
    })();
  }, [id]);

  if (!bev) {
    return (
      <View style={[base.screen, { justifyContent: 'center' }]}>
        <Text style={base.small}>Evaluation not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: bev.name }} />
      <ScrollView style={base.screen}>
        <Image
          source={{ uri: bev.imageUri }}
          style={{ width: '100%', height: 240, borderRadius: 16, marginBottom: 14, backgroundColor: colors.bg }}
          resizeMode="cover"
        />

        <Card style={{ marginBottom: 12, alignItems: 'center' }}>
          <ScoreDial value={beverageTotal(bev) * 10} size={110} />
          <Text style={[base.small, { marginTop: 10 }]}>
            {bev.beverageType} · {new Date(bev.createdAt).toLocaleString()}
          </Text>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text style={base.label}>Tasting notes</Text>
          <TastingSlider label="Aroma" value={bev.scores.aroma} onChange={() => {}} />
          <TastingSlider label="Acidity" value={bev.scores.acidity} onChange={() => {}} />
          <TastingSlider label="Body" value={bev.scores.body} onChange={() => {}} />
          <TastingSlider label="Sweetness" value={bev.scores.sweetness} onChange={() => {}} />
          <TastingSlider label="Balance" value={bev.scores.balance} onChange={() => {}} />
        </Card>

        {bev.notes && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={base.label}>Notes</Text>
            <Text style={{ color: colors.text, fontSize: 14 }}>{bev.notes}</Text>
          </Card>
        )}

        <Card style={{ marginBottom: 12 }}>
          <Text style={base.label}>Linked bean lot</Text>
          {lot ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
              onLayout={() => {}}
            >
              <Image
                source={{ uri: lot.imageUri }}
                style={{ width: 52, height: 52, borderRadius: 8, marginRight: 10, backgroundColor: colors.bg }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{lot.name}</Text>
                <Text style={base.small}>
                  {lot.beanType === 'roasted' && lot.analysis.roastLevel
                    ? `Roast: ${lot.analysis.roastLevel} · score ${lot.analysis.score}`
                    : `Green · score ${lot.analysis.score}`}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[base.small, { marginTop: 6 }]}>No bean lot linked to this cup.</Text>
          )}
          {lot && (
            <Button label="Open bean lot" variant="secondary" onPress={() => router.push(`/bean/${lot.id}`)} />
          )}
        </Card>

        <Button
          label="Delete evaluation"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete evaluation', `Delete "${bev.name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteBeverage(bev.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    </>
  );
}
