import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const PARTNERS = ['ALL', 'PickMe', 'Domex', 'SITREK', 'Pronto'];

export default function PartnerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (partner: string) => void;
}) {
  return (
    <View style={styles.row}>
      {PARTNERS.map((partner) => {
        const active = value === partner;
        return (
          <Pressable
            key={partner}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(partner)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{partner}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#e21b22', borderColor: '#e21b22' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
});
