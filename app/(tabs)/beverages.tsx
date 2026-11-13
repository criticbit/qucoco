import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import type { BeanLot, Beverage } from '../../src/types';
import { beverageTotal } from '../../src/types';
import { getBeverages, getBeanLots, deleteBeverage } from '../../src/lib/storage';
import { Card, Button, ScoreDial } from '../../src/components/ui';
import { base, colors } from '../../src/theme';

export default function BeveragesScreen() {
  const router = useRouter();
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [beanLots, setBeanLots] = useState<BeanLot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [bevs, lots] = await Promise.all([getBeverages(), getBeanLots()]);
      setBeverages(bevs);
      setBeanLots(lots);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const lotName = (id?: string) => beanLots.find((l) => l.id === id)?.name;

  function confirmDelete(bev: Beverage) {
    Alert.alert('Delete evaluation', `Delete "${bev.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBeverage(bev.id);
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
      <Text style={base.title}>Beverage Evaluations</Text>
      <Text style={base.subtitle}>
        Rate cups and link them to the bean lots they came from.
      </Text>

      <Button label="+ New evaluation" onPress={() => router.navigate('/(tabs)/scan')} />

      <View style={{ paddingBottom: 24 }}>
        {beverages.length === 0 && !loading && (
          <Text style={[base.small, { marginTop: 24, textAlign: 'center' }]}>
            No evaluations yet. Head to the Analyze tab to score your first cup.
          </Text>
        )}
        {beverages.map((bev) => (
          <Card
            key={bev.id}
            style={{ marginBottom: 12 }}
            onPress={() => router.push(`/beverage/${bev.id}`)}
          >
            <View style={{ flexDirection: 'row' }}>
              <Image
                source={{ uri: bev.imageUri }}
                style={{ width: 72, height: 72, borderRadius: 10, marginRight: 12, backgroundColor: colors.bg }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{bev.name}</Text>
                <Text style={[base.small, { marginTop: 2 }]}>
                  {bev.beverageType} · {new Date(bev.createdAt).toLocaleDateString()}
                </Text>
                {bev.beanLotId && (
                  <Text style={[base.small, { color: colors.coffee, marginTop: 2 }]}>
                    {lotName(bev.beanLotId) ? `☕ from: ${lotName(bev.beanLotId)}` : 'linked lot (removed)'}
                  </Text>
                )}
              </View>
              <ScoreDial value={beverageTotal(bev) * 10} size={64} />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
