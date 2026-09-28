/**
 * @component EditEntryModal
 * @description Modal unificado estilo Bottom Sheet para editar una entrada completa
 * (Texto, Tipo: tarea/evento/nota, Significador purista, Fecha y Hora).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppText as Text } from './Typography';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { getFormattedDate } from '../utils/dateUtils';

const DAY_NAMES_ES_MON = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_EN_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES_ES_SUN = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_NAMES_EN_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 3;

const HOURS_ARRAY = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_ARRAY = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * Componente Rueda Giratoria (Wheel Picker) para hora/minutos.
 */
function WheelColumn({ items, value, onChange, theme }) {
  const scrollViewRef = useRef(null);

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(value);
    return idx >= 0 ? idx : 0;
  }, [items, value]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedIndex]);

  const handleScrollEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    if (items[clampedIndex] !== value) {
      onChange(items[clampedIndex]);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 64, overflow: 'hidden', position: 'relative' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: theme.text,
          backgroundColor: theme.inputBackground,
          borderRadius: 10,
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
      >
        {items.map((item, idx) => {
          const isSelected = item === value;
          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.7}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => {
                scrollViewRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                onChange(item);
              }}
            >
              <Text
                style={{
                  fontSize: isSelected ? 20 : 16,
                  fontWeight: isSelected ? '700' : '400',
                  color: isSelected ? theme.text : theme.textSecondary + '70',
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function EditEntryModal({
  visible,
  entry,
  onSave,
  onDelete,
  onClose,
}) {
  const { theme, language, timezone, firstDayOfWeek = 'monday' } = useSettings();
  const insets = useSafeAreaInsets();

  const parseSafeDate = (val) => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'string' && val.includes('-')) {
      const parts = val.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      }
    }
    return new Date(val);
  };

  // Estados locales editables
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const [signifier, setSignifier] = useState(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(null);
  const [viewingMonth, setViewingMonth] = useState(new Date());

  useEffect(() => {
    if (visible && entry) {
      setText(entry.text || '');
      setType(entry.type || 'task');
      setSignifier(entry.signifier || null);

      const d = parseSafeDate(entry.date);
      setTempDate(d);
      setTempTime(entry.time || null);
      setViewingMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible, entry]);

  const todayStr = getFormattedDate(new Date(), timezone);
  const tempDateStr = getFormattedDate(tempDate, timezone);

  const changeMonth = (delta) => {
    const nextMonth = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + delta, 1);
    setViewingMonth(nextMonth);
  };

  const shortcuts = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return [
      { id: 'today', label: language === 'es' ? 'Hoy' : 'Today', date: now },
      { id: 'tomorrow', label: language === 'es' ? 'Mañana' : 'Tomorrow', date: tomorrow },
      { id: 'in3days', label: language === 'es' ? '+3 días' : '+3 days', date: in3Days },
      { id: 'nextMonday', label: language === 'es' ? 'Próx. lunes' : 'Next Mon', date: nextMonday },
      { id: 'endOfMonth', label: language === 'es' ? 'Fin de mes' : 'Month end', date: endOfMonth },
    ];
  }, [language]);

  const calendarGrid = useMemo(() => {
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();
    const firstDay = new Date(year, month, 1);

    let startDayOfWeek = 0;
    if (firstDayOfWeek === 'sunday') {
      startDayOfWeek = firstDay.getDay();
    } else {
      startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek === -1) startDayOfWeek = 6;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({
        date: prevDate,
        dateStr: getFormattedDate(prevDate, timezone),
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(year, month, day);
      cells.push({
        date: curDate,
        dateStr: getFormattedDate(curDate, timezone),
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let nextDay = 1; nextDay <= remaining; nextDay++) {
      const nextDate = new Date(year, month + 1, nextDay);
      cells.push({
        date: nextDate,
        dateStr: getFormattedDate(nextDate, timezone),
        dayNumber: nextDay,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [viewingMonth, timezone, firstDayOfWeek]);

  const handleSelectShortcut = (date) => {
    setTempDate(date);
    setViewingMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const handleSelectDay = (cell) => {
    setTempDate(cell.date);
    if (!cell.isCurrentMonth) {
      setViewingMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  };

  const handleSave = () => {
    if (!entry) return;
    onSave(entry.id, {
      text: text.trim() || entry.text,
      type,
      signifier: type === 'task' ? signifier : null,
      date: tempDateStr,
      time: tempTime,
    });
    onClose();
  };

  const monthNames = language === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const dayHeaders = firstDayOfWeek === 'sunday'
    ? (language === 'es' ? DAY_NAMES_ES_SUN : DAY_NAMES_EN_SUN)
    : (language === 'es' ? DAY_NAMES_ES_MON : DAY_NAMES_EN_MON);

  if (!visible || !entry) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.sheetContainer,
                  {
                    backgroundColor: theme.cardBackground,
                    paddingBottom: Math.max(insets.bottom, 16),
                  },
                ]}
              >
                {/* Barra tirador superior */}
                <View style={styles.handleBarContainer}>
                  <View style={[styles.handleBar, { backgroundColor: theme.textSecondary }]} />
                </View>

                {/* Cabecera */}
                <View style={styles.header}>
                  <View>
                    <Text variant="h2" style={[styles.headerTitle, { color: theme.text }]}>
                      {language === 'es' ? 'Editar entrada' : 'Edit entry'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeButton, { backgroundColor: theme.inputBackground }]}
                    accessibilityLabel="Cerrar"
                  >
                    <Ionicons name="close" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Selector de Tipo (Tarea / Evento / Nota) */}
                  <Text variant="micro" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                    {language === 'es' ? 'TIPO DE ENTRADA' : 'ENTRY TYPE'}
                  </Text>
                  <View style={styles.typeSelectorRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        { backgroundColor: type === 'task' ? theme.text : theme.inputBackground },
                      ]}
                      onPress={() => setType('task')}
                    >
                      <Ionicons
                        name="ellipse"
                        size={10}
                        color={type === 'task' ? theme.cardBackground : theme.iconInactive}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: type === 'task' ? theme.cardBackground : theme.text },
                        ]}
                      >
                        {language === 'es' ? 'Tarea' : 'Task'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        { backgroundColor: type === 'event' ? theme.text : theme.inputBackground },
                      ]}
                      onPress={() => {
                        setType('event');
                        setSignifier(null);
                      }}
                    >
                      <Ionicons
                        name="ellipse-outline"
                        size={12}
                        color={type === 'event' ? theme.cardBackground : theme.iconInactive}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: type === 'event' ? theme.cardBackground : theme.text },
                        ]}
                      >
                        {language === 'es' ? 'Evento' : 'Event'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        { backgroundColor: type === 'note' ? theme.text : theme.inputBackground },
                      ]}
                      onPress={() => {
                        setType('note');
                        setSignifier(null);
                      }}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={type === 'note' ? theme.cardBackground : theme.iconInactive}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: type === 'note' ? theme.cardBackground : theme.text },
                        ]}
                      >
                        {language === 'es' ? 'Nota' : 'Note'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Selector de Significador (si tipo === 'task') */}
                  {type === 'task' && (
                    <View style={styles.signifiersWrapper}>
                      <Text variant="micro" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                        {language === 'es' ? 'SIGNIFICADOR' : 'SIGNIFIER'}
                      </Text>
                      <View style={styles.typeSelectorRow}>
                        <TouchableOpacity
                          style={[
                            styles.typeChip,
                            { backgroundColor: signifier === null ? theme.text : theme.inputBackground },
                          ]}
                          onPress={() => setSignifier(null)}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              { color: signifier === null ? theme.cardBackground : theme.text },
                            ]}
                          >
                            {language === 'es' ? 'Ninguno' : 'None'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.typeChip,
                            { backgroundColor: signifier === 'priority' ? theme.text : theme.inputBackground },
                          ]}
                          onPress={() => setSignifier(signifier === 'priority' ? null : 'priority')}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: 'bold',
                              color: signifier === 'priority' ? theme.cardBackground : theme.text,
                            }}
                          >
                            *
                          </Text>
                          <Text
                            style={[
                              styles.typeChipText,
                              { color: signifier === 'priority' ? theme.cardBackground : theme.text },
                            ]}
                          >
                            {language === 'es' ? 'Prioridad (*)' : 'Priority (*)'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.typeChip,
                            { backgroundColor: signifier === 'inspiration' ? theme.text : theme.inputBackground },
                          ]}
                          onPress={() => setSignifier(signifier === 'inspiration' ? null : 'inspiration')}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: 'bold',
                              color: signifier === 'inspiration' ? theme.cardBackground : theme.text,
                            }}
                          >
                            !
                          </Text>
                          <Text
                            style={[
                              styles.typeChipText,
                              { color: signifier === 'inspiration' ? theme.cardBackground : theme.text },
                            ]}
                          >
                            {language === 'es' ? 'Idea (!)' : 'Idea (!)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Edición de Texto */}
                  <Text variant="micro" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                    {language === 'es' ? 'TEXTO DE LA ENTRADA' : 'ENTRY TEXT'}
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    value={text}
                    onChangeText={setText}
                    multiline={true}
                    numberOfLines={3}
                    placeholder={language === 'es' ? 'Texto de la entrada...' : 'Entry text...'}
                    placeholderTextColor={theme.textSecondary}
                  />

                  {/* Sección Fecha y Hora */}
                  <Text variant="micro" style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    {language === 'es' ? 'FECHA Y HORA' : 'DATE & TIME'}
                  </Text>

                  {/* Atajos Rápidos */}
                  <View style={styles.shortcutsWrapper}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.shortcutsContent}
                    >
                      {shortcuts.map((sc) => {
                        const scStr = getFormattedDate(sc.date, timezone);
                        const isSelected = scStr === tempDateStr;
                        return (
                          <TouchableOpacity
                            key={sc.id}
                            onPress={() => handleSelectShortcut(sc.date)}
                            style={[
                              styles.shortcutChip,
                              { backgroundColor: isSelected ? theme.text : theme.inputBackground },
                            ]}
                          >
                            <Text
                              variant="micro"
                              style={[
                                styles.shortcutText,
                                { color: isSelected ? theme.cardBackground : theme.text },
                              ]}
                            >
                              {sc.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Navegación de Mes */}
                  <View style={styles.monthNav}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavButton}>
                      <Ionicons name="chevron-back" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text variant="body" style={[styles.monthNavTitle, { color: theme.text, fontWeight: '700' }]}>
                      {monthNames[viewingMonth.getMonth()]} {viewingMonth.getFullYear()}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavButton}>
                      <Ionicons name="chevron-forward" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Días de la semana */}
                  <View style={styles.weekHeadersRow}>
                    {dayHeaders.map((dh, idx) => (
                      <View key={idx} style={styles.weekHeaderCell}>
                        <Text variant="micro" style={[styles.weekHeaderText, { color: theme.textSecondary }]}>
                          {dh}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Cuadrícula de Días */}
                  <View style={styles.gridContainer}>
                    {calendarGrid.map((cell, idx) => {
                      const isSelected = cell.dateStr === tempDateStr;
                      const isToday = cell.dateStr === todayStr;

                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSelectDay(cell)}
                          style={[
                            styles.dayCell,
                            isSelected && [styles.selectedDayCell, { backgroundColor: theme.text }],
                            isToday && !isSelected && [styles.todayCell, { borderColor: theme.textSecondary }],
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            variant="body"
                            style={[
                              styles.dayText,
                              {
                                color: isSelected
                                  ? theme.cardBackground
                                  : cell.isCurrentMonth
                                  ? theme.text
                                  : theme.textSecondary + '60',
                                fontWeight: isSelected || isToday ? '700' : '400',
                              },
                            ]}
                          >
                            {cell.dayNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Hora Específica */}
                  <View style={styles.timeSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time-outline" size={16} color={theme.text} />
                      <Text variant="body" style={{ fontWeight: '600', color: theme.text, fontSize: 13 }}>
                        {language === 'es' ? 'Hora específica' : 'Specific time'}
                      </Text>
                    </View>
                    {tempTime ? (
                      <TouchableOpacity
                        onPress={() => setTempTime(null)}
                        style={[styles.clearTimeBadge, { backgroundColor: theme.inputBackground }]}
                      >
                        <Text variant="caption" style={{ color: theme.text, fontWeight: '700' }}>
                          {tempTime}
                        </Text>
                        <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          const now = new Date();
                          const h = String(now.getHours()).padStart(2, '0');
                          const m = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0');
                          setTempTime(`${h}:${m}`);
                        }}
                        style={[styles.activateTimeButton, { backgroundColor: theme.inputBackground }]}
                      >
                        <Ionicons name="add" size={14} color={theme.text} />
                        <Text variant="caption" style={{ color: theme.text, fontWeight: '600' }}>
                          {language === 'es' ? 'Añadir hora' : 'Add time'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {tempTime ? (
                    <View style={styles.wheelContainer}>
                      <View style={styles.wheelColumnLabelWrapper}>
                        <Text variant="micro" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                          {language === 'es' ? 'HORA' : 'HOUR'}
                        </Text>
                        <WheelColumn
                          items={HOURS_ARRAY}
                          value={tempTime.split(':')[0] || '09'}
                          onChange={(h) => {
                            const m = tempTime.split(':')[1] || '00';
                            setTempTime(`${h}:${m}`);
                          }}
                          theme={theme}
                        />
                      </View>

                      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 14 }}>
                        :
                      </Text>

                      <View style={styles.wheelColumnLabelWrapper}>
                        <Text variant="micro" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                          {language === 'es' ? 'MIN' : 'MIN'}
                        </Text>
                        <WheelColumn
                          items={MINUTES_ARRAY}
                          value={tempTime.split(':')[1] || '00'}
                          onChange={(m) => {
                            const h = tempTime.split(':')[0] || '09';
                            setTempTime(`${h}:${m}`);
                          }}
                          theme={theme}
                        />
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {/* Footer / Botones de Acción */}
                <View style={styles.footer}>
                  {onDelete && (
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: theme.inputBackground }]}
                      onPress={() => {
                        onDelete(entry.id);
                        onClose();
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error || '#ff3b30'} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.text, flex: 1 }]}
                    onPress={handleSave}
                  >
                    <Text variant="h3" style={[styles.saveButtonText, { color: theme.cardBackground }]}>
                      {language === 'es' ? 'Guardar cambios' : 'Save changes'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '88%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 5,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signifiersWrapper: {
    marginTop: 4,
  },
  textInput: {
    minHeight: 64,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  shortcutsWrapper: {
    marginBottom: 10,
    marginHorizontal: -20,
  },
  shortcutsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  shortcutChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  shortcutText: {
    fontWeight: '600',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  monthNavButton: {
    padding: 4,
  },
  monthNavTitle: {
    fontSize: 15,
  },
  weekHeadersRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekHeaderText: {
    fontWeight: '600',
    opacity: 0.8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginVertical: 1,
  },
  selectedDayCell: {
    elevation: 3,
  },
  todayCell: {
    borderWidth: 1,
  },
  dayText: {
    fontSize: 14,
  },
  timeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  activateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  wheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 2,
  },
  wheelColumnLabelWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  saveButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
