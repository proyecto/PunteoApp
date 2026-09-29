/**
 * @screen ListsScreen
 * @pattern Facade Consumer + Observer Consumer
 *
 * ─── RESPONSABILIDAD ─────────────────────────────────────────────────────────
 * Esta pantalla es un CONSUMIDOR PURO de la arquitectura en capas del proyecto:
 *
 *   ┌──────────────────────────────┐
 *   │        ListsScreen.js        │  ← UI (esta pantalla)
 *   ├──────────────────────────────┤
 *   │  useDragAndDrop (Hook)       │  ← Lógica de interacción gestual
 *   ├──────────────────────────────┤
 *   │  JournalContext (Facade)     │  ← API de negocio simplificada
 *   ├──────────────────────────────┤
 *   │  ListRepository              │  ← Acceso a datos (SQLite)
 *   └──────────────────────────────┘
 *
 * La pantalla NO sabe nada de:
 *   - Cómo funciona el drag & drop internamente (lo delega a `useDragAndDrop`)
 *   - Cómo se persisten los datos (lo delega a `JournalContext`)
 *   - Cómo se ejecutan las queries SQL (lo delega a `ListRepository`)
 *
 * ─── PATRONES APLICADOS ──────────────────────────────────────────────────────
 * - Observer:  `useJournal()` y `useSettings()` suscriben la pantalla al
 *              estado global; se re-renderiza automáticamente cuando cambia.
 * - Strategy:  `useDragAndDrop` recibe `reorderLists` como función de persistencia
 *              intercambiable sin conocer la implementación concreta.
 * - Template Method: `useDragAndDrop` define el algoritmo de arrastre;
 *              los parámetros de esta pantalla (items, slotHeight) lo especializan.
 */

import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { useState } from 'react';
import { AppText as Text } from '../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useJournal } from '../context/JournalContext';
import SmartInput from '../components/SmartInput';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import SearchModal from '../components/SearchModal';
import { SYSTEM_NOTES_ARCHIVE } from '../constants/systemLists';

// ─── Constantes de Layout ─────────────────────────────────────────────────────

/**
 * Dimensiones fijas de cada "slot" para el cálculo determinista de posiciones.
 * Estos valores DEBEN coincidir con los estilos `slotContainer` y `card`
 * para que la física del drag sea coherente con el layout real.
 *
 * SLOT_HEIGHT = CARD_HEIGHT + CARD_GAP
 *   → Es la unidad de desplazamiento que el hook useDragAndDrop usa como rejilla.
 */
const CARD_HEIGHT = 56;
const CARD_GAP    = 10;
const SLOT_HEIGHT = CARD_HEIGHT + CARD_GAP;

// ─── Pantalla Principal ───────────────────────────────────────────────────────

/**
 * Pantalla "Listas" del Bullet Journal.
 *
 * Muestra todas las listas personalizadas del usuario y permite:
 *   - Crear nuevas listas mediante el SmartInput.
 *   - Navegar al detalle de una lista (ListDetailScreen).
 *   - Eliminar listas con confirmación de alerta.
 *   - Reordenar listas mediante arrastre (drag & drop animado).
 *
 * @param {Object} props
 * @param {Object} props.navigation - Objeto de navegación de React Navigation.
 */
export default function ListsScreen({ navigation }) {

  // ── Acceso a datos y configuración (Observer Pattern) ────────────────────────

  /**
   * `useSettings` y `useJournal` implementan el patrón Observer vía React Context.
   * Esta pantalla es un "suscriptor": se re-renderiza automáticamente cuando
   * el estado global cambia (por ejemplo, cuando otra pantalla añade una lista).
   */
  const { theme, language } = useSettings();
  const { lists, addList, deleteList, reorderLists } = useJournal();
  const insets = useSafeAreaInsets();

  // ── Estado local de la pantalla ──────────────────────────────────────────────

  /** Texto en curso del campo de nueva lista */
  const [inputText, setInputText] = useState('');

  /** Visibilidad del buscador global */
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleSelectSearchResult = (item) => {
    if (item.listId && navigation) {
      navigation.navigate('ListDetail', { list: { id: item.listId, title: item.listName || '' } });
    } else if ((item.date || item.completedAt) && navigation) {
      navigation.navigate('Hoy');
    }
  };

  // ── Lógica de Drag & Drop (Template Method + Strategy Pattern) ───────────────

  /**
   * Delegamos TODA la lógica de arrastre al hook especializado `useDragAndDrop`.
   *
   * Strategy aplicado: pasamos `reorderLists` como callback de persistencia.
   * El hook no sabe qué hace `reorderLists` internamente (podría ser SQLite,
   * una API REST, o localStorage); simplemente la invoca con el nuevo orden.
   *
   * Template Method aplicado: el hook define el algoritmo invariante
   * (mover dedo → calcular slot → animar → finalizar). Los parámetros
   * (items, slotHeight) especializan ese algoritmo para esta pantalla.
   */
  const {
    orderedItems: orderedLists,
    setOrderedItems: setOrderedLists,
    draggingIndex,
    itemAnimMap,
    panResponders,
    isDraggingRef,
  } = useDragAndDrop({
    items: lists,
    onReorder: reorderLists,
    slotHeight: SLOT_HEIGHT,
  });

  // ── Sincronización con el estado global (Observer) ───────────────────────────

  /**
   * Cuando el contexto global (`lists`) cambia desde fuera de esta pantalla
   * (p.ej: otra pantalla añadió/eliminó una lista), sincronizamos el estado
   * local `orderedLists` con la nueva fuente de verdad.
   *
   * GUARD: `isDraggingRef.current` evita que una actualización externa interrumpa
   * un arrastre en curso, lo que causaría un parpadeo visual.
   *
   * Comparación profunda: verificamos `id` Y `title` para detectar renombrados.
   * Una comparación solo por longitud (@shallow) generaría false negatives.
   */
  useEffect(() => {
    // No interrumpir un arrastre activo
    if (isDraggingRef.current) return;

    const isSame =
      orderedLists.length === lists.length &&
      orderedLists.every(
        (item, idx) =>
          item.id === lists[idx]?.id && item.title === lists[idx]?.title
      );

    if (!isSame) {
      // Resetear animaciones antes de re-sincronizar para evitar artefactos visuales
      Object.values(itemAnimMap).forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
      setOrderedLists(lists);
    }
  }, [lists]);

  // ── Handlers de Negocio ──────────────────────────────────────────────────────

  /**
   * Añade una nueva lista con el texto del input.
   * Guarda la operación en SQLite vía `JournalContext.addList()`.
   * Limpia el input después de añadir.
   */
  const handleAddList = () => {
    if (inputText.trim().length > 0) {
      addList(inputText.trim());
      setInputText('');
    }
  };

  /**
   * Muestra un diálogo de confirmación antes de eliminar una lista.
   * La eliminación también borra TODAS las entradas de esa lista
   * (integridad referencial gestionada en `JournalContext.deleteList`).
   *
   * @param {string} listId - ID de la lista a eliminar.
   * @param {string} title  - Título para mostrar en el mensaje de confirmación.
   */
  const confirmDelete = (listId, title) => {
    Alert.alert(
      language === 'es' ? 'Eliminar lista' : 'Delete list',
      language === 'es'
        ? `¿Estás seguro de que quieres eliminar la lista "${title}" y todas sus notas?`
        : `Are you sure you want to delete the list "${title}" and all its notes?`,
      [
        { text: language === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: language === 'es' ? 'Eliminar' : 'Delete',
          style: 'destructive',
          onPress: () => deleteList(listId),
        },
      ]
    );
  };

  // ── Renderizado ───────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.safeArea,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerNav}>
          <View style={{ width: 28 }} />
          <View style={styles.headerTitles}>
            <Text variant="h1" style={[styles.title, { color: theme.text }]}>
              {language === 'es' ? 'Listas' : 'Lists'}
            </Text>
            <Text variant="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              {language === 'es' ? 'Tus colecciones' : 'Your collections'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowSearchModal(true)} style={styles.searchIconButton}>
            <Ionicons name="search" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Lista de elementos ───────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        {/*
          scrollEnabled se desactiva durante el drag para evitar que el
          ScrollView compita con el PanResponder por el gesto del usuario.
        */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={draggingIndex === null}
        >
          {/* ── Tarjeta de sistema: Archivo de Notas (siempre primera, no borrable) ──── */}
          <View style={styles.systemSlot}>
            <TouchableOpacity
              style={[
                styles.card,
                styles.systemCard,
                { backgroundColor: theme.primary + '18', shadowColor: theme.primary },
              ]}
              onPress={() => navigation.navigate('ListDetail', { list: SYSTEM_NOTES_ARCHIVE })}
              activeOpacity={0.7}
              disabled={draggingIndex !== null}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="archive-outline" size={20} color={theme.primary} />
              </View>
              <Text
                variant="body"
                style={[styles.cardText, { color: theme.primary, fontWeight: '600' }]}
                numberOfLines={1}
              >
                {language === 'es' ? 'Archivo de Notas' : 'Notes Archive'}
              </Text>
              <Ionicons name="lock-closed-outline" size={14} color={theme.primary} style={{ opacity: 0.6, marginRight: 4 }} />
            </TouchableOpacity>
          </View>

          {orderedLists.length === 0 ? (
            // ── Estado vacío ──────────────────────────────────────────────
            <View style={styles.emptyContainer}>
              <Ionicons
                name="list"
                size={64}
                color={theme.textCompleted}
                style={styles.emptyIcon}
              />
              <Text
                variant="body"
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                {language === 'es'
                  ? 'Aquí podrás crear tus propias colecciones personalizadas (libros, películas, notas).'
                  : 'Here you will be able to create custom collections (books, movies, notes).'}
              </Text>
            </View>
          ) : (
            // ── Tarjetas de lista (con drag & drop animado) ───────────────
            orderedLists.map((item, index) => {
              const isDragging    = draggingIndex === index;
              const isDraggingAny = draggingIndex !== null;

              return (
                /**
                 * Cada tarjeta ocupa un "slot" de altura fija (SLOT_HEIGHT).
                 * El `transform.translateY` del Animated.View desplaza la tarjeta
                 * dentro de su slot sin afectar al layout de los demás.
                 *
                 * Solo aplicamos el transform durante el drag activo (isDraggingAny)
                 * para que en reposo el layout sea 100% estático y predecible.
                 */
                <Animated.View
                  key={item.id}
                  style={[
                    styles.slotContainer,
                    isDraggingAny && itemAnimMap[item.id]
                      ? { transform: [{ translateY: itemAnimMap[item.id] }] }
                      : null,
                    {
                      // El elemento arrastrado flota por encima de los demás
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
                    ]}
                  >
                    {/* ── Área principal: navegar al detalle ─────────────── */}
                    <TouchableOpacity
                      style={styles.cardMainArea}
                      onPress={() => navigation.navigate('ListDetail', { list: item })}
                      activeOpacity={0.7}
                      // Deshabilitar tap mientras hay un drag en curso para evitar
                      // navegaciones accidentales
                      disabled={draggingIndex !== null}
                    >
                      <View style={styles.iconContainer}>
                        <Ionicons name="list" size={20} color={theme.textSecondary} />
                      </View>
                      <Text
                        variant="body"
                        style={[styles.cardText, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </TouchableOpacity>

                    {/* ── Acciones: eliminar y arrastrar ─────────────────── */}
                    <View style={styles.actionButtons}>
                      {/* Botón de eliminar con confirmación */}
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => confirmDelete(item.id, item.title)}
                        accessibilityLabel={
                          language === 'es' ? 'Eliminar listado' : 'Delete list'
                        }
                        accessibilityRole="button"
                        disabled={draggingIndex !== null}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={theme.error || '#ff3b30'}
                        />
                      </TouchableOpacity>

                      {/*
                        Handle de arrastre: recibe los panHandlers del PanResponder
                        creado por `useDragAndDrop` para este índice concreto.
                        Al ser un View (no un TouchableOpacity), no compite con
                        el tap del área principal.
                      */}
                      <View
                        style={styles.dragHandle}
                        {...panResponders[index]?.panHandlers}
                        accessibilityLabel={
                          language === 'es'
                            ? 'Arrastrar para ordenar'
                            : 'Drag to reorder'
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

      {/* ── Input de nueva lista ─────────────────────────────────────────── */}
      <SmartInput
        value={inputText}
        onChangeText={setInputText}
        onSubmit={handleAddList}
        placeholder={language === 'es' ? 'Nueva lista...' : 'New list...'}
      />

      {/* ── Modal de Búsqueda Global ────────────────────────────────────────── */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectResult={handleSelectSearchResult}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  /** Cabecera centrada con título y subtítulo */
  header: {
    paddingHorizontal: 24,
    paddingTop:        20,
    paddingBottom:     10,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitles: { alignItems: 'center' },
  searchIconButton: { padding: 4 },
  title:    { letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { marginTop: 4, textAlign: 'center' },

  /**
   * Contenedor del ScrollView: `flexGrow: 1` asegura que el estado vacío
   * pueda centrarse verticalmente incluso cuando hay pocos elementos.
   */
  listContent: {
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     20,
    flexGrow:          1,
  },

  /**
   * Cada "slot" tiene una altura FIJA igual a CARD_HEIGHT + CARD_GAP.
   * Esto es fundamental para que el algoritmo del hook pueda calcular
   * los desplazamientos de forma determinista.
   *
   * El slot NO se desplaza; es el Animated.View que envuelve el card
   * quien se mueve mediante `transform.translateY` dentro del slot.
   */
  slotContainer: {
    minHeight:    CARD_HEIGHT,
    marginBottom: CARD_GAP,
  },

  /** Tarjeta con sombra y bordes redondeados */
  card: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    borderRadius:    12,
    shadowOffset:    { width: 0, height: 2 },
    shadowRadius:    4,
  },

  /** Tarjeta del sistema: añade altura fija y margen para alinearse con los slots */
  systemSlot: {
    height:        CARD_HEIGHT,
    marginBottom:  CARD_GAP,
  },

  systemCard: {
    flex:          1,
    shadowOpacity: 0.06,
  },

  /** Área táctil principal (navegación al detalle) */
  cardMainArea: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 12,
  },

  /** Contenedor del icono de lista */
  iconContainer: {
    width:          32,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    12,
  },

  /** Texto del título de la lista */
  cardText: { flex: 1 },

  /** Contenedor de los botones de acción (eliminar + handle de arrastre) */
  actionButtons: { flexDirection: 'row', alignItems: 'center' },

  /** Área táctil del botón de papelera */
  iconButton: { padding: 8, marginLeft: 2 },

  /**
   * Handle de arrastre: área táctil dedicada exclusivamente al PanResponder.
   * El padding asegura un área de toque cómoda (mínimo 44×44pt según HIG).
   */
  dragHandle: {
    padding:        8,
    marginLeft:     4,
    marginRight:    -4,
    alignItems:     'center',
    justifyContent: 'center',
  },

  /** Estado vacío: centrado vertical con padding lateral */
  emptyContainer: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 40,
    marginTop:         60,
  },
  emptyIcon: { opacity: 0.5, marginBottom: 16 },
  emptyText: { textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
});
