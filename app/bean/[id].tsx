import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import type { BeanLot, Beverage } from '../../src/types';
import { beverageTotal } from '../../src/types';
import { getBeanLots, getBeverages, deleteBeanLot } from '../../src/lib/storage';
import { Card, Button, ScoreDial, StatBar } from '../../src/components/ui';
import { base, colors } from '../../src/theme';

export default function BeanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lot, setLot] = useState<BeanLot | null>(null);
  const [linked, setLinked] = useState<Beverage[]>([]);

  useEffect(() => {
    (async () => {
      const lots = await getBeanLots();
      const lot = lots.find((l) => l.id === id) ?? null;
      setLot(lot);
      if (lot) {
        const bevs = await getBeverages();
        setLinked(bevs.filter((b) => b.beanLotId === lot.id));
      }
    })();
  }, [id]);

  if (!lot) {
    return (
      <View style={[base.screen, { justifyContent: 'center' }]}>
        <Text style={base.small}>Lot not found.</Text>
      </View>
    );
  }

  const a = lot.analysis;

  return (
    <>
      <Stack.Screen options={{ title: lot.name }} />
      <ScrollView style={base.screen}>
        <Image
          source={{ uri: lot.imageUri }}
          style={{ width: '100%', height: 240, borderRadius: 16, marginBottom: 14, backgroundColor: colors.bg }}
          resizeMode="cover"
        />

        <Card style={{ marginBottom: 12, alignItems: 'center' }}>
          <ScoreDial value={a.score} size={110} />
          {lot.beanType === 'roasted' && a.roastLevel && (
            <Text style={{ fontWeight: '700', color: colors.coffee, marginTop: 10, fontSize: 16 }}>
              Estimated roast: {a.roastLevel}
            </Text>
          )}
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text style={base.label}>Analysis details</Text>
          <StatBar label="Type match" value={a.typeMatch} />
          <StatBar label="Color uniformity" value={a.uniformity} />
          {lot.beanType === 'roasted' && <StatBar label="Roast intensity" value={a.roastIntensity ?? 0} />}
          <Text style={base.small}>Mean luminance: {a.meanLuminance}</Text>
        </Card>

        <Card style={{ marginBottom: 12 }} onPress={lot.cropPlotId ? () => router.push({ pathname: '/plot/[id]', params: { id: lot.cropPlotId! } }) : undefined}>
          <Text style={base.label}>Info</Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            {lot.origin ?? 'No origin recorded'} · {new Date(lot.createdAt).toLocaleString()}
          </Text>
          {lot.cropPlotId ? (
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600', marginTop: 6 }}>
              From plot: {lot.cropPlotId.slice(-6).toUpperCase()} ›
            </Text>
          ) : null}
          {lot.notes ? <Text style={[base.small, { marginTop: 6 }]}>{lot.notes}</Text> : null}
        </Card>

        <Text style={[base.title, { fontSize: 17 }]}>Beverages from this lot</Text>
        {linked.length === 0 && (
          <Text style={[base.small, { marginTop: 4, marginBottom: 12 }]}>
            No linked cups yet. In Analyze → Beverage you can link evaluations to this lot.
          </Text>
        )}
        {linked.map((b) => (
          <Card key={b.id} style={{ marginBottom: 10 }} onPress={() => router.push(`/beverage/${b.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={{ uri: b.imageUri }}
                style={{ width: 52, height: 52, borderRadius: 8, marginRight: 10, backgroundColor: colors.bg }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{b.name}</Text>
                <Text style={base.small}>{b.beverageType} · score {beverageTotal(b)}</Text>
              </View>
            </View>
          </Card>
        ))}

        <Button
          label="Delete lot"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete lot', 'This also unlinks its beverages.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteBeanLot(lot.id);
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
