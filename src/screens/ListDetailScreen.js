/**
 * @screen ListDetailScreen
 * @pattern Facade Consumer + Observer Consumer + Strategy Consumer
 *
 * ─── RESPONSABILIDAD ─────────────────────────────────────────────────────────
 * Pantalla de detalle de una lista personalizada del usuario.
 *
 * Arquitectura en capas:
 *   ┌──────────────────────────────┐
 *   │     ListDetailScreen.js      │  ← UI (esta pantalla)
 *   ├──────────────────────────────┤
 *   │  useDragAndDrop (Hook)       │  ← Lógica de interacción gestual
 *   ├──────────────────────────────┤
 *   │  JournalContext (Facade)     │  ← API de negocio simplificada
 *   ├──────────────────────────────┤
 *   │  EntryRepository             │  ← Acceso a datos (SQLite)
 *   └──────────────────────────────┘
 *
 * ─── FUNCIONALIDADES ─────────────────────────────────────────────────────────
 * - Muestra todos los elementos de la lista seleccionada.
 * - Permite añadir nuevos elementos mediante SmartInput.
 * - Permite alternar el estado de cada elemento (open/completed).
 * - Permite eliminar elementos con confirmación.
 * - Permite reordenar elementos mediante drag & drop animado.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  SectionList,
} from 'react-native';
import { AppText as Text } from '../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSignifierSymbol } from '../services/DailyLogService';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useJournal } from '../context/JournalContext';
import EditEntryModal from '../components/EditEntryModal';
import SmartInput from '../components/SmartInput';
import { createListEntry } from '../factories/EntryFactory';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { SYSTEM_NOTES_ARCHIVE_ID } from '../constants/systemLists';
import { getNoteArchiveEntries } from '../repositories/EntryRepository';

// ─── Constantes de Layout ─────────────────────────────────────────────────────

/**
 * Dimensiones fijas de cada "slot" para el cálculo determinista de posiciones.
 * SLOT_HEIGHT = CARD_HEIGHT + CARD_GAP  →  unidad de rejilla para el drag.
 */
const CARD_HEIGHT = 56;
const CARD_GAP    = 10;
const SLOT_HEIGHT = CARD_HEIGHT + CARD_GAP;

// ─── Pantalla Principal ───────────────────────────────────────────────────────

/**
 * Pantalla de detalle de una lista personalizada.
 *
 * @param {Object} props
 * @param {Object} props.route      - Objeto de ruta de React Navigation (contiene `list`).
 * @param {Object} props.navigation - Objeto de navegación de React Navigation.
 */
export default function ListDetailScreen({ route, navigation }) {

  /**
   * La lista seleccionada se pasa como parámetro de ruta desde ListsScreen.
   * Contiene al menos: { id, title }
   */
  const { list } = route.params;

  /** Indica si esta pantalla muestra la lista de sistema "Archivo de Notas" */
  const isArchive = list.id === SYSTEM_NOTES_ARCHIVE_ID;

  // ── Acceso a datos y configuración (Observer Pattern) ────────────────────────

  const { theme, language, timezone } = useSettings();
  const { entries, toggleStatus, toggleSignifier, addEntry, deleteEntry, updateEntry, reorderEntries } = useJournal();
  const insets = useSafeAreaInsets();

  // ── Estado local ──────────────────────────────────────────────────────────────

  /** Texto en curso del campo de nuevo elemento */
  const [inputText, setInputText] = useState('');

  /** Significador purista seleccionado para el nuevo elemento ('priority' | 'inspiration' | null) */
  const [selectedSignifier, setSelectedSignifier] = useState(null);

  /** Elemento que el usuario está editando (pulsación larga) */
  const [editingItem, setEditingItem] = useState(null);

  const handleSaveEditedEntry = (id, updatedFields) => {
    updateEntry(id, updatedFields);
    setEditingItem(null);
  };

  /** Entradas del Archivo de Notas (solo en modo archivo) */
  const [archiveEntries, setArchiveEntries] = useState([]);

  /**
   * Carga las notas del Archivo cuando el modo es archivo.
   * Se recarga también cuando `entries` cambia (el usuario borra una nota desde el Daily Log).
   */
  useEffect(() => {
    if (!isArchive) return;
    getNoteArchiveEntries().then(setArchiveEntries).catch(() => {});
  }, [isArchive, entries]);

  /**
   * Agrupa las notas del Archivo por mes/año para facilitar el escaneo visual.
   * Formato de sección: "Septiembre 2026"
   */
  const archiveSections = useMemo(() => {
    if (!isArchive) return [];
    const groups = {};
    archiveEntries.forEach((entry) => {
      const [year, month] = entry.date.split('-');
      const key = `${year}-${month}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return Object.entries(groups).map(([key, data]) => {
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      const title = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        month: 'long',
        year:  'numeric',
      });
      return { title, data };
    });
  }, [archiveEntries, isArchive, language]);

  // ── Filtrado de entradas de la lista ──────────────────────────────────────────

  /**
   * Filtramos y ordenamos las entradas que pertenecen a esta lista.
   * `useMemo` garantiza que el filtro solo se recalcula cuando `entries`
   * o `list.id` cambian, no en cada render.
   *
   * El orden viene dado por `order_index`, asignado al crear cada elemento
   * y actualizado por `reorderEntries` tras cada drag & drop.
   */
  const listItems = useMemo(
    () =>
      entries
        .filter((entry) => entry.listId === list.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [entries, list.id]
  );

  // ── Lógica de Drag & Drop (Template Method + Strategy Pattern) ───────────────

  /**
   * Delegamos TODA la lógica de arrastre al hook especializado.
   *
   * Strategy: `reorderEntries` es la estrategia de persistencia intercambiable.
   * Template Method: el hook define el algoritmo; `slotHeight` lo especializa.
   */
  const {
    orderedItems,
    setOrderedItems,
    draggingIndex,
    itemAnimMap,
    panResponders,
    isDraggingRef,
  } = useDragAndDrop({
    items: listItems,
    onReorder: reorderEntries,
    slotHeight: SLOT_HEIGHT,
  });

  // ── Sincronización con el estado global (Observer) ───────────────────────────

  /**
   * Cuando el contexto global (`entries`) cambia (nuevo elemento, toggle, eliminación),
   * sincronizamos el estado local con la nueva fuente de verdad.
   *
   * GUARD: `isDraggingRef.current` evita que una actualización interrumpa un drag activo.
   *
   * Comparación profunda por `id`, `status` y `text` para detectar cualquier
   * cambio relevante (no solo reordenaciones).
   */
  useEffect(() => {
    if (isDraggingRef.current) return;

    const isSame =
      orderedItems.length === listItems.length &&
      orderedItems.every(
        (item, idx) =>
          item.id        === listItems[idx]?.id        &&
          item.status    === listItems[idx]?.status    &&
          item.signifier === listItems[idx]?.signifier &&
          item.text      === listItems[idx]?.text
      );

    if (!isSame) {
      // Resetear animaciones antes de re-sincronizar
      Object.values(itemAnimMap).forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
      setOrderedItems(listItems);
    }
  }, [entries, list.id]);

  // ── Handlers de Negocio ──────────────────────────────────────────────────────

  /**
   * Añade un nuevo elemento a la lista.
   * Usa `EntryFactory.createListEntry` para garantizar la estructura correcta,
   * incluyendo el `listId`, `date` (timezone-aware) y `order_index`.
   */
  const handleAddItem = () => {
    if (!inputText.trim()) return;

    const newEntry = createListEntry(
      inputText,
      list.id,
      timezone,
      orderedItems.length,  // order_index = al final de la lista actual
      selectedSignifier
    );
    addEntry(newEntry);
    setInputText('');
    setSelectedSignifier(null);
  };

  /**
   * Muestra un diálogo de confirmación antes de eliminar un elemento.
   * @param {string} id - ID del elemento a eliminar.
   */
  const confirmDeleteItem = (id) => {
    Alert.alert(
      language === 'es' ? 'Eliminar elemento' : 'Delete item',
      language === 'es'
        ? '¿Estás seguro de que quieres eliminar este elemento de forma permanente?'
        : 'Are you sure you want to delete this item permanently?',
      [
        { text: language === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: language === 'es' ? 'Eliminar' : 'Delete',
          style: 'destructive',
          onPress: () => deleteEntry(id),
        },
      ]
    );
  };

  // ── Renderizado ───────────────────────────────────────────────────────────────

  // ── MODO ARCHIVO ─────────────────────────────────────────────────────────────
  if (isArchive) {
    const archiveTitle = language === 'es' ? 'Archivo de Notas' : 'Notes Archive';
    const emptyMsg     = language === 'es'
      ? 'Aún no hay notas. Las notas que escribas en el Diario aparecerán aquí.'
      : 'No notes yet. Notes you write in the Daily Log will appear here.';

    const confirmDeleteArchiveItem = (id) => {
      Alert.alert(
        language === 'es' ? 'Eliminar nota' : 'Delete note',
        language === 'es'
          ? '¿Eliminar esta nota del diario de forma permanente?'
          : 'Permanently delete this note from the journal?',
        [
          { text: language === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
          { text: language === 'es' ? 'Eliminar' : 'Delete', style: 'destructive', onPress: () => deleteEntry(id) },
        ]
      );
    };

    return (
      <View style={[styles.safeArea, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {/* Cabecera */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text variant="h2" style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {archiveTitle}
            </Text>
            <Text variant="caption" style={[styles.subtitle, { color: theme.textSecondary }]}>
              {archiveEntries.length} {language === 'es' ? 'notas' : 'notes'}
            </Text>
          </View>
        </View>

        {archiveEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="archive-outline" size={64} color={theme.textCompleted} style={styles.emptyIcon} />
            <Text variant="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
              {emptyMsg}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={archiveSections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            renderSectionHeader={({ section: { title } }) => (
              <Text
                variant="caption"
                style={[styles.archiveSectionHeader, { color: theme.textSecondary }]}
              >
                {title.charAt(0).toUpperCase() + title.slice(1)}
              </Text>
            )}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.archiveCard,
                  { backgroundColor: theme.cardBackground, shadowColor: theme.text },
                ]}
              >
                <View style={styles.archiveCardContent}>
                  {/* Bala de nota (–) */}
                  <Text style={[styles.archiveBullet, { color: theme.textSecondary }]}>–</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ color: theme.text }} numberOfLines={3}>
                      {item.text}
                    </Text>
                    <Text variant="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {item.date}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => confirmDeleteArchiveItem(item.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.error || '#ff3b30'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // ── MODO NORMAL (lista de usuario) ───────────────────────────────────

  return (
    <View
      style={[
        styles.safeArea,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      {/* ── Cabecera con botón de retroceso y título de la lista ──────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text variant="h2" style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {list.title}
          </Text>
          {/* Contador de elementos: usa el estado local para ser consistente durante el drag */}
          <Text variant="caption" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {orderedItems.length} {language === 'es' ? 'elementos' : 'items'}
          </Text>
        </View>
      </View>

      {/* ── Lista de elementos con drag & drop animado ───────────────────── */}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={draggingIndex === null}
        >
          {orderedItems.length === 0 ? (
            // ── Estado vacío ──────────────────────────────────────────────
            <View style={styles.emptyContainer}>
              <Ionicons
                name="documents-outline"
                size={64}
                color={theme.textCompleted}
                style={styles.emptyIcon}
              />
              <Text
                variant="body"
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                {language === 'es'
                  ? 'Esta lista está vacía. Añade el primer elemento abajo.'
                  : 'This list is empty. Add the first item below.'}
              </Text>
            </View>
          ) : (
            // ── Tarjetas de elemento (con drag & drop animado) ────────────
            orderedItems.map((item, index) => {
              const isDragging    = draggingIndex === index;
              const isDraggingAny = draggingIndex !== null;
              const isCompleted   = item.status === 'completed';

              return (
                <Animated.View
                  key={item.id}
                  style={[
                    styles.slotContainer,
                    isDraggingAny && itemAnimMap[item.id]
                      ? { transform: [{ translateY: itemAnimMap[item.id] }] }
                      : null,
                    {
                      zIndex:    isDragging ? 999 : 1,
                      elevation: isDragging ? 8   : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.cardBackground,
                        shadowColor:     theme.text,
                        shadowOpacity:   isDragging ? 0.3  : 0.03,
                        opacity:         isDragging ? 0.95 : 1,
                      },
                      isCompleted && { backgroundColor: theme.cardCompleted },
                    ]}
                  >
                    {/* ── Área principal: toggle de significador (* / !) + toggle de estado completado ──── */}
                    <View style={styles.cardMainArea}>
                      {/* Bullet visual + significador purista (* / !) */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, paddingVertical: 4 }}
                        onPress={() => toggleSignifier(item.id)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        disabled={draggingIndex !== null}
                        activeOpacity={0.5}
                      >
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
                        <View style={[styles.bullet, { borderColor: theme.text, marginRight: 0 }]}>
                          {isCompleted && <Ionicons name="close" size={16} color={theme.text} />}
                        </View>
                      </TouchableOpacity>

                      {/* Texto del elemento con tachado si está completado */}
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 4 }}
                        onPress={() => toggleStatus(item.id, null)}
                        onLongPress={() => setEditingItem(item)}
                        delayLongPress={350}
                        activeOpacity={0.7}
                        disabled={draggingIndex !== null}
                      >
                        <Text
                          variant="body"
                          style={[
                            styles.cardText,
                            { color: isCompleted ? theme.textCompleted : theme.text },
                            isCompleted && styles.itemTextCompleted,
                          ]}
                          numberOfLines={3}
                        >
                          {item.text}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* ── Acciones: eliminar y arrastrar ──────────────────── */}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => confirmDeleteItem(item.id)}
                        accessibilityLabel={language === 'es' ? 'Eliminar' : 'Delete'}
                        accessibilityRole="button"
                        disabled={draggingIndex !== null}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={theme.error || '#ff3b30'}
                        />
                      </TouchableOpacity>

                      {/* Handle de arrastre: View (no TouchableOpacity) para evitar conflicto con el tap */}
                      <View
                        style={styles.dragHandle}
                        {...panResponders[index]?.panHandlers}
                        accessibilityLabel={
                          language === 'es' ? 'Arrastrar para ordenar' : 'Drag to reorder'
                        }
                      >
                        <Ionicons
                          name="menu"
                          size={24}
                          color={isDragging ? theme.primary : theme.textSecondary}
                        />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ── Input de nuevo elemento ──────────────────────────────────────── */}
      <SmartInput
        value={inputText}
        onChangeText={setInputText}
        onSubmit={handleAddItem}
        placeholder={language === 'es' ? 'Añadir elemento...' : 'Add item...'}
        topContent={
          <>
            {/* Significador purista: Prioridad (*) */}
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: selectedSignifier === 'priority' ? theme.primary : theme.inputBackground },
              ]}
              onPress={() => setSelectedSignifier(selectedSignifier === 'priority' ? null : 'priority')}
              accessibilityLabel={language === 'es' ? 'Prioridad (*)' : 'Priority (*)'}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: selectedSignifier === 'priority' ? '#FFFFFF' : theme.iconInactive,
                }}
              >
                *
              </Text>
            </TouchableOpacity>

            {/* Significador purista: Inspiración (!) */}
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: selectedSignifier === 'inspiration' ? theme.primary : theme.inputBackground },
              ]}
              onPress={() => setSelectedSignifier(selectedSignifier === 'inspiration' ? null : 'inspiration')}
              accessibilityLabel={language === 'es' ? 'Inspiración (!)' : 'Inspiration (!)'}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: selectedSignifier === 'inspiration' ? '#FFFFFF' : theme.iconInactive,
                }}
              >
                !
              </Text>
            </TouchableOpacity>
          </>
        }
      />

      {/* ── Modal: Edición completa del elemento (texto, tipo, significador, fecha, hora) ──── */}
      <EditEntryModal
        visible={!!editingItem}
        entry={editingItem}
        onSave={handleSaveEditedEntry}
        onDelete={confirmDeleteItem}
        onClose={() => setEditingItem(null)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  /** Cabecera: botón atrás + título de la lista */
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        10,
    paddingBottom:     15,
  },
  backButton: { marginRight: 12, padding: 4 },
  headerTitleContainer: { flex: 1 },
  title: { letterSpacing: -0.5 },
  subtitle: { marginTop: 2 },

  listContent: {
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     20,
    flexGrow:          1,
  },

  /** Slot de altura fija: unidad fundamental de la rejilla del drag */
  slotContainer: {
    height:       CARD_HEIGHT,
    marginBottom: CARD_GAP,
  },

  card: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    borderRadius:      12,
    shadowOffset:      { width: 0, height: 2 },
    shadowRadius:      4,
  },
  cardMainArea: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 12,
  },

  /**
   * Bullet visual al estilo Bullet Journal.
   * Círculo con borde que puede contener un ícono "close" si está completado.
   */
  bullet: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    2,
    marginRight:    12,
    alignItems:     'center',
    justifyContent: 'center',
  },

  signifierText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },

  cardText: { flex: 1 },
  itemTextCompleted: { textDecorationLine: 'line-through' },

  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8, marginLeft: 2 },
  dragHandle: {
    padding:        8,
    marginLeft:     4,
    marginRight:    -4,
    alignItems:     'center',
    justifyContent: 'center',
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 40,
    marginTop:         60,
  },
  emptyIcon: { opacity: 0.5, marginBottom: 16 },
  emptyText: { textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },

  /** Encabezado de sección del archivo (mes/año) */
  archiveSectionHeader: {
    textTransform: 'capitalize',
    marginTop:     20,
    marginBottom:  8,
    paddingHorizontal: 4,
    fontWeight:    '600',
    letterSpacing: 0.5,
  },

  /** Tarjeta de nota en el Archivo */
  archiveCard: {
    borderRadius:    12,
    marginBottom:    10,
    paddingHorizontal: 16,
    paddingVertical:   12,
    shadowOffset:    { width: 0, height: 1 },
    shadowRadius:    3,
    shadowOpacity:   0.04,
  },

  archiveCardContent: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },

  archiveBullet: {
    fontSize:    18,
    marginRight: 12,
    marginTop:   1,
  },
});
