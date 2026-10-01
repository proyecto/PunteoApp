import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useJournal, getFormattedDate } from '../context/JournalContext';
import { useSettings } from '../context/SettingsContext';
import CustomDatePickerModal from '../components/CustomDatePickerModal';
import { filterEntriesForDay, getEntryIcon, isEntryCompleted, getSignifierSymbol } from '../services/DailyLogService';
import SearchModal from '../components/SearchModal';

// Configurar el idioma del calendario
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene.', 'Feb.', 'Mar', 'Abr', 'May', 'Jun', 'Jul.', 'Ago', 'Sept.', 'Oct.', 'Nov.', 'Dic.'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  today: 'Today'
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarScreen({ navigation }) {
  const { entries, toggleStatus, toggleSignifier, updateEntryDate } = useJournal();
  const { theme, language, timezone, firstDayOfWeek = 'monday' } = useSettings();
  const insets = useSafeAreaInsets();
  const today = getFormattedDate(new Date(), timezone);
  const [selectedDate, setSelectedDate] = useState(today);
  const [reschedulingItem, setReschedulingItem] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  LocaleConfig.defaultLocale = language || 'es';

  useEffect(() => {
    LocaleConfig.defaultLocale = language || 'es';
  }, [language]);

  const handleSelectSearchResult = (item) => {
    if (item.listId && navigation) {
      navigation.navigate('Listas', {
        screen: 'ListDetail',
        params: { list: { id: item.listId, title: item.listName || '' } },
      });
    } else if (item.date || item.completedAt) {
      const targetDate = item.date || item.completedAt;
      setSelectedDate(targetDate);
    }
  };

  const markedDates = useMemo(() => {
    const marks = {};
    
    // 1. Identificar todos los días que tienen alguna entrada (tarea, evento o nota)
    entries.forEach(entry => {
      if (entry.listId) return;

      let entryDate = null;
      if (entry.status === 'completed' && entry.completedAt) {
        entryDate = entry.completedAt;
      } else if (entry.status === 'open' && entry.type === 'task') {
        if (entry.date && entry.date > today) {
          entryDate = entry.date;
        } else {
          entryDate = today;
        }
      } else if (entry.date) {
        entryDate = entry.date;
      }

      if (entryDate) {
        marks[entryDate] = true;
      }
    });

    const result = {};
    const allDates = new Set([...Object.keys(marks), today, selectedDate]);

    allDates.forEach(dateStr => {
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;
      const hasEntries = !!marks[dateStr];

      const itemConfig = {};

      // Punto debajo del número si hay alguna tarea, evento o nota
      if (hasEntries) {
        itemConfig.marked = true;
        itemConfig.dotColor = isSelected
          ? '#FFFFFF'
          : (theme.primary || '#007AFF');
      }

      // Estilos customizados
      if (isSelected) {
        // Día visualizado: contenedor con color primario del tema y texto de alto contraste
        itemConfig.customStyles = {
          container: {
            backgroundColor: theme.primary,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          },
          text: {
            color: '#FFFFFF',
            fontWeight: '700',
            backgroundColor: 'transparent',
          },
        };
      } else if (isToday) {
        // Día actual (HOY): indicador sutil y elegante con color primario
        itemConfig.customStyles = {
          container: {
            borderWidth: 1.5,
            borderColor: theme.primary,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          },
          text: {
            color: theme.primary,
            fontWeight: '700',
            backgroundColor: 'transparent',
          },
        };
      }

      result[dateStr] = itemConfig;
    });

    return result;
  }, [entries, selectedDate, theme, today]);

  // Título legible para la cabecera de la lista inferior
  const formattedDateTitle = useMemo(() => {
    if (selectedDate === today) {
      return language === 'es' ? 'Hoy' : 'Today';
    }
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day, 12, 0, 0);
      const formatted = d.toLocaleDateString(
        language === 'es' ? 'es-ES' : 'en-US',
        { weekday: 'long', day: 'numeric', month: 'long' }
      );
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return selectedDate;
    }
  }, [selectedDate, today, language]);

  // Filtrar las entradas para el día seleccionado usando el servicio central
  const selectedEntries = useMemo(() => {
    return filterEntriesForDay(entries, selectedDate, today);
  }, [entries, selectedDate, today]);

  const renderItem = useCallback(({ item }) => {
    const isCompleted = isEntryCompleted(item, today);
    const iconName = getEntryIcon(item, today);
    const iconColor = isCompleted
      ? theme.textCompleted
      : item.type === 'task'
      ? theme.primary
      : theme.textSecondary;

    return (
      <View style={[styles.itemContainer, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={styles.iconContainer}
          onPress={() => toggleSignifier(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
          <Ionicons 
            name={iconName} 
            size={item.type === 'note' ? 20 : 14} 
            color={iconColor} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 4 }}
          onPress={() => item.type !== 'note' && toggleStatus(item.id, selectedDate)}
          onLongPress={() => setReschedulingItem(item)}
          delayLongPress={350}
          activeOpacity={0.7}
        >
          <Text variant="body" style={[styles.itemText, { color: theme.text }, isCompleted && { color: theme.textCompleted, textDecorationLine: 'line-through' }]}>
            {item.text}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [today, theme, toggleSignifier, toggleStatus, selectedDate]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text variant="h1" style={[styles.title, { color: theme.text }]}>
          {language === 'es' ? 'Registro Futuro' : 'Future Log'}
        </Text>
        <TouchableOpacity onPress={() => setShowSearchModal(true)} style={styles.searchIconButton}>
          <Ionicons name="search" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>
      <Calendar
        markingType="custom"
        current={selectedDate}
        firstDay={firstDayOfWeek === 'sunday' ? 0 : 1}
        onDayPress={day => {
          setSelectedDate(day.dateString);
        }}
        markedDates={markedDates}
        key={`${theme.id}_${language}`}
        theme={{
          backgroundColor: theme.background,
          calendarBackground: theme.background,
          textSectionTitleColor: theme.textSecondary,
          textSectionTitleDisabledColor: theme.textCompleted,
          selectedDayBackgroundColor: theme.primary,
          selectedDayTextColor: '#FFFFFF',
          todayTextColor: theme.primary,
          todayBackgroundColor: 'transparent',
          dayTextColor: theme.text,
          textDisabledColor: theme.textCompleted,
          dotColor: theme.primary,
          selectedDotColor: '#FFFFFF',
          disabledDotColor: theme.textCompleted,
          todayDotColor: theme.primary,
          arrowColor: theme.text,
          disabledArrowColor: theme.textCompleted,
          monthTextColor: theme.text,
          indicatorColor: theme.primary,
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 16,
          textMonthFontSize: 20,
          textDayHeaderFontSize: 14,
          // Fix: rgba(0,0,0,0) renderiza como negro visible en Android.
          textDayStyle: { backgroundColor: 'transparent' },
          // Override de estilos internos del componente BasicDay
          'stylesheet.day.basic': {
            base: {
              width: 32,
              height: 32,
              alignItems: 'center',
            },
            today: {
              backgroundColor: 'transparent',
              borderRadius: 16,
            },
            selected: {
              backgroundColor: theme.primary,
              borderRadius: 16,
            },
            text: {
              fontSize: 16,
              fontWeight: '500',
              color: theme.text,
              backgroundColor: 'transparent',
              marginTop: 4,
            },
            todayText: {
              color: theme.primary,
            },
            selectedText: {
              color: '#FFFFFF',
            },
            disabledText: {
              color: theme.textCompleted,
            },
            inactiveText: {
              color: theme.textCompleted,
            },
          },
          // Override de contenedor principal del calendario
          'stylesheet.calendar.main': {
            container: {
              paddingLeft: 5,
              paddingRight: 5,
              backgroundColor: theme.background,
            },
            monthView: {
              backgroundColor: theme.background,
            },
            week: {
              marginVertical: 7,
              flexDirection: 'row',
              justifyContent: 'space-around',
            },
          },
        }}
        style={[styles.calendar, { borderColor: theme.border, backgroundColor: theme.background }]}
      />
      
      <View style={styles.listHeader}>
        <Text variant="h2" style={[styles.listTitle, { color: theme.text }]}>
          {formattedDateTitle}
        </Text>
      </View>

      <FlatList
        data={selectedEntries}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.emptyDate}>
            <Text variant="body" style={[styles.emptyDateText, { color: theme.textSecondary }]}>
              {language === 'es' ? 'Ningún registro en este día.' : 'No entries on this day.'}
            </Text>
          </View>
        }
      />

      {/* Modal selector de fecha para MOVER una entrada al hacer pulsación prolongada */}
      <CustomDatePickerModal
        visible={!!reschedulingItem}
        selectedDate={reschedulingItem?.date || selectedDate}
        onSelectDate={(newDate) => {
          if (reschedulingItem) {
            updateEntryDate(reschedulingItem.id, getFormattedDate(newDate, timezone));
            setReschedulingItem(null);
          }
        }}
        onClose={() => setReschedulingItem(null)}
      />

      {/* Modal de Búsqueda Global */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectResult={handleSelectSearchResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { letterSpacing: -0.5, textAlign: 'center' },
  searchIconButton: { padding: 4 },
  calendar: {
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  listTitle: {
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signifierText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 3,
  },
  itemText: {
    flex: 1,
  },
  dateBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8, 
    overflow: 'hidden',
    marginLeft: 8
  },
  emptyDate: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyDateText: {
  }
});
