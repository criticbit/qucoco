import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F6F1EA',
  card: '#FFFFFF',
  coffee: '#4B2E1E',
  coffeeDark: '#2E1B10',
  accent: '#B97B4A',
  accentLight: '#E8C9A8',
  text: '#2B1D14',
  textMuted: '#8A7263',
  success: '#4E7A3F',
  warn: '#C08A2D',
  danger: '#A63B2E',
};

export const radius = 14;

export const base = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  small: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
