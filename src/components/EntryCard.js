/**
 * @component EntryCard
 * Componente memoizado para renderizar una tarjeta de entrada (tarea, evento o nota)
 * en el Daily Log, Listas y Calendario.
 *
 * Optimizado con React.memo para evitar re-renders masivos al escribir en campos de texto,
 * cambiar de pestaña o alternar estados secundarios.
 */

import React, { memo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { AppText as Text } from './Typography';
import { Ionicons } from '@expo/vector-icons';
import {
  getEntryIcon,
  isEntryCompleted,
  getSignifierSymbol,
  isEntryMigrated,
} from '../services/DailyLogService';

function EntryCard({
  item,
  theme,
  language = 'es',
  todayStr,
  currentLogDateStr,
  onToggleStatus,
  onToggleSignifier,
  onLongPress,
  onDelete,
  dragHandleHandlers,
  isDragging = false,
  isDisabled = false,
  showDragHandle = true,
  showDeleteButton = true,
}) {
  const isCompleted = isEntryCompleted(item, todayStr || currentLogDateStr);
  const isMigrated = isEntryMigrated(item, todayStr || currentLogDateStr);
  const iconName = getEntryIcon(item, todayStr || currentLogDateStr);
  const iconColor = isCompleted
    ? theme.textCompleted
    : item.type === 'task'
    ? theme.primary
    : theme.textSecondary;

  const signifierSymbol = getSignifierSymbol(item.signifier);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground },
        isDragging && {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 8,
          borderColor: theme.primary,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.leftContainer}>
        {/* Botón de significador e icono principal */}
        <TouchableOpacity
          style={styles.iconContainer}
          onPress={() => onToggleSignifier && onToggleSignifier(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.5}
          disabled={isDisabled}
        >
          {isMigrated ? (
            <Text
              style={[
                styles.signifierText,
                { color: isCompleted ? theme.textCompleted : theme.primary, marginRight: item.signifier ? 0 : 2 },
              ]}
            >
              {'>'}
            </Text>
          ) : null}
          {signifierSymbol ? (
            <Text
              style={[
                styles.signifierText,
                { color: isCompleted ? theme.textCompleted : theme.primary },
              ]}
            >
              {signifierSymbol}
            </Text>
          ) : null}
          <Ionicons
            name={iconName}
            size={item.type === 'note' ? 24 : 16}
            color={iconColor}
            style={item.type === 'task' && !isCompleted ? styles.taskIcon : null}
          />
        </TouchableOpacity>

        {/* Texto de la entrada + hora opcional */}
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => item.type !== 'note' && onToggleStatus && onToggleStatus(item.id, currentLogDateStr)}
          onLongPress={() => onLongPress && onLongPress(item)}
          delayLongPress={350}
          activeOpacity={0.7}
          disabled={isDisabled}
        >
          {item.time ? (
            <View style={[styles.timeBadge, { backgroundColor: theme.inputBackground }]}>
              <Text style={[styles.timeBadgeText, { color: isCompleted ? theme.textCompleted : theme.text }]}>
                {item.time}
              </Text>
            </View>
          ) : null}

          <Text
            variant="body"
            style={[
              styles.cardText,
              { color: theme.text },
              isCompleted && { color: theme.textCompleted, textDecorationLine: 'line-through' },
            ]}
            numberOfLines={3}
          >
            {item.text}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Acciones: eliminar y arrastrar */}
      <View style={styles.actionButtons}>
        {showDeleteButton && onDelete ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onDelete(item.id)}
            accessibilityLabel={language === 'es' ? 'Eliminar' : 'Delete'}
            accessibilityRole="button"
            disabled={isDisabled}
          >
            <Ionicons name="trash-outline" size={18} color={theme.error || '#ff3b30'} />
          </TouchableOpacity>
        ) : null}

        {showDragHandle && dragHandleHandlers ? (
          <View
            style={styles.dragHandle}
            {...dragHandleHandlers}
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
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  iconContainer: {
    padding: 6,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  signifierText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 3,
  },
  taskIcon: {
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardText: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },
});

/**
 * Comparación personalizada de props para React.memo:
 * Solo re-renderiza la tarjeta si cambia alguna propiedad relevante de los datos
 * o el estado visual/tema.
 */
function arePropsEqual(prevProps, nextProps) {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.text === nextProps.item.text &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.signifier === nextProps.item.signifier &&
    prevProps.item.time === nextProps.item.time &&
    prevProps.item.date === nextProps.item.date &&
    prevProps.item.type === nextProps.item.type &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDisabled === nextProps.isDisabled &&
    prevProps.theme === nextProps.theme &&
    prevProps.language === nextProps.language &&
    prevProps.todayStr === nextProps.todayStr &&
    prevProps.currentLogDateStr === nextProps.currentLogDateStr
  );
}

export default memo(EntryCard, arePropsEqual);
