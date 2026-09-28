import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import { AppText as Text } from './Typography';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJournal } from '../context/JournalContext';
import { useSettings } from '../context/SettingsContext';
import { searchEntries } from '../services/SearchService';
import { getEntryIcon, isEntryCompleted, getSignifierSymbol } from '../services/DailyLogService';

/**
 * Modal de búsqueda global minimalista.
 * Permite buscar instantáneamente en todas las entradas del diario y listas.
 *
 * @param {Object} props
 * @param {boolean} props.visible - Controla la visibilidad del modal.
 * @param {Function} props.onClose - Callback al cerrar el buscador.
 * @param {Function} [props.onSelectResult] - Callback al seleccionar un resultado.
 */
export default function SearchModal({ visible, onClose, onSelectResult }) {
  const { entries, lists } = useJournal();
  const { theme, language, timezone } = useSettings();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchEntries(entries, lists, debouncedQuery, language),
    [entries, lists, debouncedQuery, language]
  );

  const handleClose = () => {
    setQuery('');
    setDebouncedQuery('');
    onClose();
  };

  const handleSelect = (item) => {
    if (onSelectResult) {
      onSelectResult(item);
    }
    handleClose();
  };

  const renderResultItem = ({ item }) => {
    const isCompleted = isEntryCompleted(item, todayStr);
    const iconName = getEntryIcon(item, todayStr);

    return (
      <TouchableOpacity
        style={[styles.resultCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {item.signifier ? (
            <Text
              style={[
                styles.signifierText,
                { color: isCompleted ? theme.textCompleted : theme.text },
              ]}
            >
              {getSignifierSymbol(item.signifier)}
            </Text>
          ) : null}
          <Ionicons
            name={iconName}
            size={item.type === 'note' ? 20 : 14}
            color={isCompleted ? theme.textCompleted : theme.text}
          />
        </View>

        <View style={styles.textContent}>
          <Text
            variant="body"
            style={[
              styles.itemText,
              { color: theme.text },
              isCompleted && { color: theme.textCompleted, textDecorationLine: 'line-through' },
            ]}
            numberOfLines={2}
          >
            {item.text}
          </Text>

          <Text variant="caption" style={[styles.originBadge, { color: theme.primary }]}>
            {item.listName
              ? (language === 'es' ? `Lista: ${item.listName}` : `List: ${item.listName}`)
              : (item.date || item.completedAt || (language === 'es' ? 'Hoy' : 'Today'))}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) },
        ]}
      >
        {/* ── Cabecera de Búsqueda ──────────────────────────────────────── */}
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={language === 'es' ? 'Buscar tareas, notas, eventos...' : 'Search tasks, notes, events...'}
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Lista de Resultados ────────────────────────────────────────── */}
        {query.trim().length > 0 ? (
          <FlatList
            data={results}
            renderItem={renderResultItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                <Text variant="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {language === 'es' ? 'No se encontraron resultados' : 'No matching results'}
                </Text>
              </View>
            }
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text variant="body" style={[styles.placeholderText, { color: theme.textSecondary }]}>
              {language === 'es' ? 'Escribe para buscar en tus diarios y listas' : 'Type to search across entries and lists'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: { padding: 8, marginRight: 4 },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signifierText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 3,
  },
  textContent: { flex: 1, marginRight: 8 },
  itemText: { fontSize: 15, marginBottom: 2 },
  originBadge: { fontSize: 12, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: { marginTop: 12, fontSize: 15 },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  placeholderText: { textAlign: 'center', fontSize: 15 },
});
