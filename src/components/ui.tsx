import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, base } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? colors.coffee
      : variant === 'danger'
      ? colors.danger
      : colors.accentLight;
  const fg = variant === 'secondary' ? colors.coffee : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const content = <View style={[base.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      {content}
    </Pressable>
  );
}

/** Circular score badge showing a 0..100 value with a qualitative label */
export function ScoreDial({ value, size = 92 }: { value: number; size?: number }) {
  const color = value >= 75 ? colors.success : value >= 50 ? colors.warn : colors.danger;
  const label = value >= 75 ? 'good' : value >= 50 ? 'ok' : 'poor';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 8,
        borderColor: color,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.26, fontWeight: '800', color: colors.text }}>
        {Math.round(value)}
      </Text>
      <Text style={{ fontSize: size * 0.12, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

/** Horizontal 0..100 bar */
export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.statRow}>
        <Text style={base.small}>{label}</Text>
        <Text style={styles.statValue}>{Math.round(value * 100)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={{
            width: `${Math.max(2, Math.min(100, value * 100))}%`,
            height: '100%',
            borderRadius: 5,
            backgroundColor: colors.accent,
          }}
        />
      </View>
    </View>
  );
}

/** 0..10 slider shown as a row of tappable dots */
export function TastingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.statRow}>
        <Text style={[styles.statLabel, { fontWeight: '600' }]}>{label}</Text>
        <Text style={styles.statValue}>{value.toFixed(1)}</Text>
      </View>
      <View style={styles.dotsRow}>
        {Array.from({ length: 11 }, (_, i) => (
          <TouchableOpacity key={i} onPress={() => onChange(i)}>
            <View
              style={[
                styles.dot,
                i <= value && { backgroundColor: colors.coffee, transform: [{ scale: 1.15 }] },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function ModalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheetWrap}>
        <View style={[styles.sheet, base.card]}>
          <Text style={base.title}>{title}</Text>
          {children}
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={base.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

export function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: colors.coffee, borderColor: colors.coffee },
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statValue: { fontSize: 13, fontWeight: '700', color: colors.coffee },
  statLabel: { fontSize: 13, color: colors.text },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EBDFCE',
    overflow: 'hidden',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E3D5C4',
  },
  sheetWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 0,
    padding: 20,
    paddingBottom: 32,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E3D5C4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
