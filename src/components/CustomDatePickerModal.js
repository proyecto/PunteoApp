/**
 * @component CustomDatePickerModal
 * @description Selector de fecha moderno y minimalista estilo Bottom Sheet,
 * 100% integrado con el sistema de diseño, temas (claro/oscuro) y tipografía de la app.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { AppText as Text } from './Typography';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { getFormattedDate } from '../utils/dateUtils';

const DAY_NAMES_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
 * Componente Rueda Giratoria de selección (Wheel Picker) vertical para React Native.
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
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 68, overflow: 'hidden', position: 'relative' }}>
      {/* Indicador visual de elemento seleccionado (Caja central) */}
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
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
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

const DAY_NAMES_ES_MON = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_EN_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DAY_NAMES_ES_SUN = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_NAMES_EN_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CustomDatePickerModal({
  visible,
  selectedDate,
  selectedTime: initialSelectedTime = null,
  onSelectDate,
  onClose,
}) {
  const { theme, language, timezone, firstDayOfWeek = 'monday' } = useSettings();
  const insets = useSafeAreaInsets();

  // Función segura para parsear cadenas 'YYYY-MM-DD' o Date objects sin desfase de huso horario
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

  // Fecha temporal seleccionada dentro del modal
  const initialDate = useMemo(() => parseSafeDate(selectedDate), [selectedDate]);

  const [tempDate, setTempDate] = useState(initialDate);
  const [tempTime, setTempTime] = useState(initialSelectedTime);
  // Mes y año visualizados en el calendario (1er día de ese mes)
  const [viewingMonth, setViewingMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  useEffect(() => {
    if (visible) {
      const d = parseSafeDate(selectedDate);
      setTempDate(d);
      setTempTime(initialSelectedTime || null);
      setViewingMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible, selectedDate, initialSelectedTime]);

  const todayStr = getFormattedDate(new Date(), timezone);
  const tempDateStr = getFormattedDate(tempDate, timezone);

  // Navegar meses en el calendario
  const changeMonth = (delta) => {
    const nextMonth = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + delta, 1);
    setViewingMonth(nextMonth);
  };

  // Cálculo de los atajos rápidos
  const shortcuts = useMemo(() => {
    const now = new Date();
    
    // Mañana
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // En 3 días
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    // Próximo lunes
    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay(); // 0 = Dom, 1 = Lun ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);

    // Fin de mes
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return [
      {
        id: 'today',
        label: language === 'es' ? 'Hoy' : 'Today',
        date: now,
      },
      {
        id: 'tomorrow',
        label: language === 'es' ? 'Mañana' : 'Tomorrow',
        date: tomorrow,
      },
      {
        id: 'in3days',
        label: language === 'es' ? '+3 días' : '+3 days',
        date: in3Days,
      },
      {
        id: 'nextMonday',
        label: language === 'es' ? 'Próx. lunes' : 'Next Mon',
        date: nextMonday,
      },
      {
        id: 'endOfMonth',
        label: language === 'es' ? 'Fin de mes' : 'Month end',
        date: endOfMonth,
      },
    ];
  }, [language, viewingMonth]);

  // Generación de la cuadrícula de días del mes visualizado
  const calendarGrid = useMemo(() => {
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    
    let startDayOfWeek = 0;
    if (firstDayOfWeek === 'sunday') {
      startDayOfWeek = firstDay.getDay(); // 0 = Domingo, 1 = Lunes ...
    } else {
      startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek === -1) startDayOfWeek = 6;
    }

    // Total de días en el mes actual
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Total de días en el mes anterior
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Días del mes anterior (de relleno al inicio)
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({
        date: prevDate,
        dateStr: getFormattedDate(prevDate, timezone),
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(year, month, day);
      cells.push({
        date: curDate,
        dateStr: getFormattedDate(curDate, timezone),
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    // Días del mes siguiente (para completar la cuadrícula de 35 o 42 celdas)
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

  const handleConfirm = () => {
    onSelectDate(tempDate, tempTime);
    onClose();
  };

  const monthNames = language === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const dayHeaders = firstDayOfWeek === 'sunday'
    ? (language === 'es' ? DAY_NAMES_ES_SUN : DAY_NAMES_EN_SUN)
    : (language === 'es' ? DAY_NAMES_ES_MON : DAY_NAMES_EN_MON);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: theme.cardBackground,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              {/* Barra tirador superior */}
              <View style={styles.handleBarContainer}>
                <View style={[styles.handleBar, { backgroundColor: theme.textSecondary }]} />
              </View>

              {/* Cabecera del Modal */}
              <View style={styles.header}>
                <View>
                  <Text variant="h2" style={[styles.headerTitle, { color: theme.text }]}>
                    {language === 'es' ? 'Seleccionar fecha u hora' : 'Select date or time'}
                  </Text>
                  <Text variant="caption" style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    {tempDate.toLocaleDateString(
                      language === 'es' ? 'es-ES' : 'en-US',
                      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
                    )}
                    {tempTime ? ` · ${tempTime}` : ''}
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

              {/* Fila de Atajos Rápidos */}
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
                          {
                            backgroundColor: isSelected ? theme.primary : theme.inputBackground,
                          },
                        ]}
                      >
                        <Text
                          variant="micro"
                          style={[
                            styles.shortcutText,
                            { color: isSelected ? '#FFFFFF' : theme.text },
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
                  <Ionicons name="chevron-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text variant="h3" style={[styles.monthNavTitle, { color: theme.text }]}>
                  {monthNames[viewingMonth.getMonth()]} {viewingMonth.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavButton}>
                  <Ionicons name="chevron-forward" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Encabezados de Días de la Semana */}
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
                        isSelected && [styles.selectedDayCell, { backgroundColor: theme.primary }],
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

              {/* Sección de Hora Específica (Ruedas Giratorias 00..23 / 00..59) */}
              <View style={styles.timeSectionWrapper}>
                <View style={styles.timeSectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={18} color={theme.text} />
                    <Text variant="body" style={{ fontWeight: '600', color: theme.text }}>
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
                  <View style={styles.pickerAndPresetsRow}>
                    {/* Ruedas Giratorias para Hora (00..23) y Minutos (00..59) */}
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

                      <Text style={{ fontSize: 24, fontWeight: '700', color: theme.text, marginTop: 16 }}>
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
                  </View>
                ) : null}
              </View>

              {/* Botón de Confirmación */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                  onPress={handleConfirm}
                >
                  <Text variant="h3" style={[styles.confirmButtonText, { color: '#FFFFFF' }]}>
                    {language === 'es' ? 'Listo' : 'Apply'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingVertical: 8,
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
    marginBottom: 14,
  },
  headerTitle: {
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 2,
    textTransform: 'capitalize',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsWrapper: {
    marginBottom: 16,
    marginHorizontal: -20,
  },
  shortcutsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  shortcutChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  shortcutText: {
    fontWeight: '600',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 6,
  },
  monthNavButton: {
    padding: 6,
  },
  monthNavTitle: {
    letterSpacing: -0.3,
  },
  weekHeadersRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekHeaderText: {
    fontWeight: '600',
    opacity: 0.8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  selectedDayCell: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  todayCell: {
    borderWidth: 1,
  },
  dayText: {
    fontSize: 15,
  },
  timeSectionWrapper: {
    marginTop: 4,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  timeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  pickerAndPresetsRow: {
    alignItems: 'center',
  },
  wheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  wheelColumnLabelWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  timeChipsContent: {
    gap: 6,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  footer: {
    paddingTop: 4,
  },
  confirmButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
