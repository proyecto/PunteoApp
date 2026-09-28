// Global mocks for Jest in Expo environment

// Mock expo-font
jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
  useFonts: jest.fn(() => [true, null]),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Mock expo-speech-recognition
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    getStateAsync: jest.fn(() => Promise.resolve('inactive')),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props) => React.createElement(Text, props, props.name),
  };
}, { virtual: true });

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 40, right: 0, bottom: 20, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    useSafeAreaInsets: () => inset,
  };
});

// Mock in-memory SQLite store for repositories/contexts
const createMockDb = () => {
  let entriesStore = [];
  let listsStore = [];
  let settingsStore = {};

  return {
    execSync: jest.fn((sql) => {
      if (sql.includes('DELETE FROM entries')) {
        entriesStore = [];
        listsStore = [];
        settingsStore = {};
      }
    }),
    getAllAsync: jest.fn(async (sql, params = []) => {
      if (sql.includes('FROM entries') || sql.includes('v_note_archive') || sql.includes('v_open_daily_tasks')) {
        return [...entriesStore];
      }
      if (sql.includes('FROM lists')) {
        return [...listsStore];
      }
      if (sql.includes('FROM settings')) {
        return Object.entries(settingsStore).map(([key, value]) => ({ key, value }));
      }
      return [];
    }),
    runAsync: jest.fn(async (sql, params = []) => {
      if (sql.includes('INSERT INTO entries')) {
        const [id, text, type, status, date, completedAt, listId, order_index] = params;
        entriesStore.push({ id, text, type, status, date, completedAt, listId, order_index });
      } else if (sql.includes('UPDATE entries SET status = ?')) {
        const [status, completedAt, id] = params;
        const entry = entriesStore.find(e => e.id === id);
        if (entry) {
          entry.status = status;
          entry.completedAt = completedAt;
        }
      } else if (sql.includes('UPDATE entries SET text = ?')) {
        const [text, type, signifier, date, time, id] = params;
        const entry = entriesStore.find(e => e.id === id);
        if (entry) {
          entry.text = text;
          entry.type = type;
          entry.signifier = signifier;
          entry.date = date;
          entry.time = time;
        }
      } else if (sql.includes('UPDATE entries SET date = ?')) {
        const [date, id] = params;
        const entry = entriesStore.find(e => e.id === id);
        if (entry) entry.date = date;
      } else if (sql.includes('UPDATE entries SET order_index =')) {
        if (sql.includes('CASE')) {
          const numPairs = Math.floor((params.length / 3) * 2);
          for (let i = 0; i < numPairs; i += 2) {
            const id = params[i];
            const order = params[i + 1];
            const entry = entriesStore.find(e => e.id === id);
            if (entry) entry.order_index = order;
          }
        } else {
          const [order_index, id] = params;
          const entry = entriesStore.find(e => e.id === id);
          if (entry) entry.order_index = order_index;
        }
      } else if (sql.includes('DELETE FROM entries WHERE id = ?')) {
        const [id] = params;
        entriesStore = entriesStore.filter(e => e.id !== id);
      } else if (sql.includes('DELETE FROM entries WHERE listId = ?')) {
        const [listId] = params;
        entriesStore = entriesStore.filter(e => e.listId !== listId);
      } else if (sql.includes('INSERT INTO lists')) {
        const [id, title, order_index] = params;
        listsStore.push({ id, title, order_index });
      } else if (sql.includes('UPDATE lists SET order_index =')) {
        if (sql.includes('CASE')) {
          const numPairs = Math.floor((params.length / 3) * 2);
          for (let i = 0; i < numPairs; i += 2) {
            const id = params[i];
            const order = params[i + 1];
            const list = listsStore.find(l => l.id === id);
            if (list) list.order_index = order;
          }
        } else {
          const [order_index, id] = params;
          const list = listsStore.find(l => l.id === id);
          if (list) list.order_index = order_index;
        }
      } else if (sql.includes('DELETE FROM lists WHERE id = ?')) {
        const [id] = params;
        listsStore = listsStore.filter(l => l.id !== id);
      } else if (sql.includes('INSERT OR REPLACE INTO settings')) {
        const [key, value] = params;
        settingsStore[key] = value;
      }
      return { changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql, params = []) => {
      if (sql.includes('FROM settings WHERE key = ?')) {
        const [key] = params;
        if (settingsStore[key] !== undefined) {
          return { value: settingsStore[key] };
        }
      }
      return null;
    }),
    withTransactionAsync: jest.fn(async (callback) => {
      return await callback();
    }),
    withTransactionSync: jest.fn((callback) => {
      return callback();
    }),
  };
};

const mockDatabase = createMockDb();
global.__mockDb = mockDatabase;

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDatabase),
}));
