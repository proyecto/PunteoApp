import * as EntryRepository from './EntryRepository';
import * as ListRepository from './ListRepository';
import * as SettingsRepository from './SettingsRepository';

describe('Repositories Integration with SQLite Store', () => {
  beforeEach(() => {
    // Clear the in-memory mock db
    global.__mockDb.execSync('DELETE FROM entries');
  });

  describe('EntryRepository', () => {
    it('inserts and retrieves entries correctly', async () => {
      const entry = {
        id: 'entry-1',
        text: 'Test task',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 0,
      };

      await EntryRepository.insertEntry(entry);
      const all = await EntryRepository.getAllEntries();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('entry-1');
      expect(all[0].text).toBe('Test task');
    });

    it('inserts entry with defaults for order_index and completedAt', async () => {
      const entry = {
        id: 'entry-default',
        text: 'Default task',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
      };
      await EntryRepository.insertEntry(entry);
      const all = await EntryRepository.getAllEntries();
      expect(all[0].order_index).toBe(0);
      expect(all[0].completedAt).toBeNull();
    });

    it('updates entry status and completedAt', async () => {
      const entry = {
        id: 'entry-2',
        text: 'Task to complete',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 0,
      };
      await EntryRepository.insertEntry(entry);
      await EntryRepository.updateEntryStatus('entry-2', 'completed', '2026-09-16');

      const all = await EntryRepository.getAllEntries();
      expect(all[0].status).toBe('completed');
      expect(all[0].completedAt).toBe('2026-09-16');
    });

    it('updates entry date', async () => {
      const entry = {
        id: 'entry-3',
        text: 'Migrated task',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 0,
      };
      await EntryRepository.insertEntry(entry);
      await EntryRepository.updateEntryDate('entry-3', '2026-09-17');

      const all = await EntryRepository.getAllEntries();
      expect(all[0].date).toBe('2026-09-17');
    });

    it('updates entry full fields (text, type, signifier, date, time)', async () => {
      const entry = {
        id: 'entry-edit-1',
        text: 'Original task',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        signifier: null,
        time: null,
      };
      await EntryRepository.insertEntry(entry);
      await EntryRepository.updateEntry('entry-edit-1', {
        text: 'Updated event text',
        type: 'event',
        signifier: 'priority',
        date: '2026-09-20',
        time: '14:30',
      });

      const all = await EntryRepository.getAllEntries();
      const updated = all.find(e => e.id === 'entry-edit-1');
      expect(updated.text).toBe('Updated event text');
      expect(updated.type).toBe('event');
      expect(updated.signifier).toBe('priority');
      expect(updated.date).toBe('2026-09-20');
      expect(updated.time).toBe('14:30');
    });

    it('updates entry order_index', async () => {
      const entry = {
        id: 'entry-4',
        text: 'Reordered task',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 0,
      };
      await EntryRepository.insertEntry(entry);
      await EntryRepository.updateEntryOrder('entry-4', 5);

      const all = await EntryRepository.getAllEntries();
      expect(all[0].order_index).toBe(5);
    });

    it('deletes entry by id', async () => {
      const entry = {
        id: 'entry-to-del',
        text: 'Task to delete',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 0,
      };
      await EntryRepository.insertEntry(entry);
      await EntryRepository.deleteEntryById('entry-to-del');

      const all = await EntryRepository.getAllEntries();
      expect(all).toHaveLength(0);
    });

    it('deletes entries by listId', async () => {
      const entry1 = {
        id: 'entry-list-1',
        text: 'List item 1',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: 'list-123',
        order_index: 0,
      };
      const entry2 = {
        id: 'entry-list-2',
        text: 'Daily item',
        type: 'task',
        status: 'open',
        date: '2026-09-16',
        completedAt: null,
        listId: null,
        order_index: 1,
      };
      await EntryRepository.insertEntry(entry1);
      await EntryRepository.insertEntry(entry2);

      await EntryRepository.deleteEntriesByListId('list-123');

      const all = await EntryRepository.getAllEntries();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('entry-list-2');
    });

    it('handles batchUpdateEntryOrders and batchInsertEntries atomically', async () => {
      const entriesToBatch = [
        { id: 'b-1', text: 'Task 1', type: 'task', status: 'open', date: '2026-09-17' },
        { id: 'b-2', text: 'Task 2', type: 'task', status: 'open', date: '2026-09-17' },
      ];
      await EntryRepository.batchInsertEntries(entriesToBatch);

      let all = await EntryRepository.getAllEntries();
      expect(all.find(e => e.id === 'b-1')).toBeTruthy();
      expect(all.find(e => e.id === 'b-2')).toBeTruthy();

      await EntryRepository.batchUpdateEntryOrders([
        { id: 'b-1', order_index: 10 },
        { id: 'b-2', order_index: 20 },
      ]);

      all = await EntryRepository.getAllEntries();
      expect(all.find(e => e.id === 'b-1').order_index).toBe(10);
      expect(all.find(e => e.id === 'b-2').order_index).toBe(20);
    });
  });

  describe('ListRepository', () => {
    it('inserts, retrieves, updates order, and deletes lists', async () => {
      const list = {
        id: 'list-abc',
        title: 'Groceries',
        order_index: 0,
      };
      await ListRepository.insertList(list);

      let lists = await ListRepository.getAllLists();
      expect(lists).toHaveLength(1);
      expect(lists[0].title).toBe('Groceries');

      await ListRepository.updateListOrder('list-abc', 3);
      lists = await ListRepository.getAllLists();
      expect(lists[0].order_index).toBe(3);

      await ListRepository.deleteList('list-abc');
      lists = await ListRepository.getAllLists();
      expect(lists).toHaveLength(0);
    });

    it('handles batchInsertLists and batchUpdateListOrders atomically', async () => {
      const batchLists = [
        { id: 'bl-1', title: 'List 1', order_index: 0 },
        { id: 'bl-2', title: 'List 2', order_index: 1 },
      ];
      await ListRepository.batchInsertLists(batchLists);

      let lists = await ListRepository.getAllLists();
      expect(lists.find(l => l.id === 'bl-1')).toBeTruthy();
      expect(lists.find(l => l.id === 'bl-2')).toBeTruthy();

      await ListRepository.batchUpdateListOrders([
        { id: 'bl-1', order_index: 5 },
        { id: 'bl-2', order_index: 6 },
      ]);

      lists = await ListRepository.getAllLists();
      expect(lists.find(l => l.id === 'bl-1').order_index).toBe(5);
      expect(lists.find(l => l.id === 'bl-2').order_index).toBe(6);
    });
  });

  describe('SettingsRepository', () => {
    it('saves and retrieves user settings', async () => {
      await SettingsRepository.saveSetting('themePreference', 'dark');
      await SettingsRepository.saveSetting('customConfig', { fontSize: 16 });

      const settings = await SettingsRepository.getAllSettings();
      expect(settings.themePreference).toBe('dark');
      expect(settings.customConfig).toBe(JSON.stringify({ fontSize: 16 }));
    });
  });
});
