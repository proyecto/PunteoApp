import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';

// Screens
import DailyLogScreen from '../screens/DailyLogScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ListsScreen from '../screens/ListsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ListDetailScreen from '../screens/ListDetailScreen';
import AdvancedTypographyScreen from '../screens/AdvancedTypographyScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const ListsStack = createNativeStackNavigator();

// Stack interno para la pestaña "Listas" que mantiene visible la barra de navegación
function ListsStackNavigator() {
  return (
    <ListsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListsStack.Screen name="ListsHome" component={ListsScreen} />
      <ListsStack.Screen name="ListDetail" component={ListDetailScreen} />
    </ListsStack.Navigator>
  );
}

function BottomTabs() {
  const { theme, language } = useSettings();
  const insets = useSafeAreaInsets();

  // Aseguramos un padding mínimo de 12, pero sumamos el inset nativo (si lo hay)
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Hoy') {
            iconName = focused ? 'journal' : 'journal-outline';
          } else if (route.name === 'Calendario') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Listas') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Ajustes') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.iconInactive,
        headerShown: false,
        tabBarHideOnKeyboard: true, // Ocultar pestañas al escribir
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.tabBar,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 10,
          paddingBottom: bottomPadding,
          height: 55 + bottomPadding,
        }
      })}
    >
      <Tab.Screen 
        name="Hoy" 
        component={DailyLogScreen} 
        options={{ title: language === 'es' ? 'Log Diario' : 'Daily Log' }}
      />
      <Tab.Screen 
        name="Calendario" 
        component={CalendarScreen} 
        options={{ title: language === 'es' ? 'Future Log' : 'Future Log' }}
      />
      <Tab.Screen 
        name="Listas" 
        component={ListsStackNavigator} 
        options={{ title: language === 'es' ? 'Listas' : 'Lists' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevenir el comportamiento por defecto de React Navigation
            e.preventDefault();
            // Forzar navegación al inicio del Stack de listas ("ListsHome")
            navigation.navigate('Listas', {
              screen: 'ListsHome',
            });
          },
        })}
      />
      <Tab.Screen 
        name="Ajustes" 
        component={SettingsScreen} 
        options={{ title: language === 'es' ? 'Ajustes' : 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabs} />
      <Stack.Screen name="AdvancedTypography" component={AdvancedTypographyScreen} />
    </Stack.Navigator>
  );
}
