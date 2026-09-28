import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { JournalProvider, useJournal } from './JournalContext';
import * as EntryRepository from '../repositories/EntryRepository';
import * as ListRepository from '../repositories/ListRepository';
import { createDailyEntry } from '../factories/EntryFactory';

describe('JournalContext', () => {
  beforeEach(() => {
    global.__mockDb.execSync('DELETE FROM entries');
  });

  it('throws an error when useJournal is called outside of JournalProvider', async () => {
    // Suppress console.error during error boundary test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useJournal())).rejects.toThrow(
      '[useJournal] Debe usarse dentro de un <JournalProvider>.'
    );
    consoleSpy.mockRestore();
  });

  it('loads entries and lists on mount', async () => {
    await ListRepository.insertList({ id: 'list-1', title: 'Work', order_index: 0 });
    await EntryRepository.insertEntry({
      id: 'entry-1',
      text: 'Existing Task',
      type: 'task',
      status: 'open',
      date: '2026-09-16',
      completedAt: null,
      listId: null,
      order_index: 0,
    });

    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => {
      expect(result.current?.lists).toHaveLength(1);
      expect(result.current?.entries).toHaveLength(1);
    });

    expect(result.current.lists[0].title).toBe('Work');
    expect(result.current.entries[0].text).toBe('Existing Task');
  });

  it('adds an entry and persists it', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const newEntry = createDailyEntry('New Daily Task', 'task', '2026-09-16');

    await act(async () => {
      await result.current.addEntry(newEntry);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].text).toBe('New Daily Task');

    const dbEntries = await EntryRepository.getAllEntries();
    expect(dbEntries).toHaveLength(1);
    expect(dbEntries[0].id).toBe(newEntry.id);
  });

  it('adds a list with correct order_index', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.addList('Personal');
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].title).toBe('Personal');
    expect(result.current.lists[0].order_index).toBe(0);

    const dbLists = await ListRepository.getAllLists();
    expect(dbLists).toHaveLength(1);
  });

  it('toggles task status and updates completedAt', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const task = createDailyEntry('Task to complete', 'task', '2026-09-16');
    await act(async () => {
      await result.current.addEntry(task);
    });

    // Toggle open -> completed
    await act(async () => {
      await result.current.toggleStatus(task.id, '2026-09-16');
    });

    expect(result.current.entries[0].status).toBe('completed');
    expect(result.current.entries[0].completedAt).toBe('2026-09-16');

    // Toggle completed -> open
    await act(async () => {
      await result.current.toggleStatus(task.id, '2026-09-16');
    });

    expect(result.current.entries[0].status).toBe('open');
    expect(result.current.entries[0].completedAt).toBeNull();
  });

  it('toggles signifier in order: null -> priority -> inspiration -> null', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const task = createDailyEntry('Task with signifier', 'task', '2026-09-16');
    await act(async () => {
      await result.current.addEntry(task);
    });

    expect(result.current.entries[0].signifier).toBeNull();

    // Toggle 1: null -> priority
    await act(async () => {
      await result.current.toggleSignifier(task.id);
    });
    expect(result.current.entries[0].signifier).toBe('priority');

    // Toggle 2: priority -> inspiration
    await act(async () => {
      await result.current.toggleSignifier(task.id);
    });
    expect(result.current.entries[0].signifier).toBe('inspiration');

    // Toggle 3: inspiration -> null
    await act(async () => {
      await result.current.toggleSignifier(task.id);
    });
    expect(result.current.entries[0].signifier).toBeNull();
  });

  it('deletes an entry from state and database', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const entry = createDailyEntry('Delete me', 'task', '2026-09-16');
    await act(async () => {
      await result.current.addEntry(entry);
    });

    expect(result.current.entries).toHaveLength(1);

    await act(async () => {
      await result.current.deleteEntry(entry.id);
    });

    expect(result.current.entries).toHaveLength(0);
    const dbEntries = await EntryRepository.getAllEntries();
    expect(dbEntries).toHaveLength(0);
  });

  it('updates entry date', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const entry = createDailyEntry('Task to migrate', 'task', '2026-09-16');
    await act(async () => {
      await result.current.addEntry(entry);
    });

    await act(async () => {
      await result.current.updateEntryDate(entry.id, '2026-09-20');
    });

    expect(result.current.entries[0].date).toBe('2026-09-20');
    const dbEntries = await EntryRepository.getAllEntries();
    expect(dbEntries[0].date).toBe('2026-09-20');
  });

  it('updates entry full fields with updateEntry', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const entry = createDailyEntry('Task to edit', 'task', '2026-09-16');
    await act(async () => {
      await result.current.addEntry(entry);
    });

    await act(async () => {
      await result.current.updateEntry(entry.id, {
        text: 'Edited task text',
        type: 'event',
        signifier: 'priority',
        date: '2026-09-22',
        time: '18:00',
      });
    });

    const updated = result.current.entries.find(e => e.id === entry.id);
    expect(updated.text).toBe('Edited task text');
    expect(updated.type).toBe('event');
    expect(updated.signifier).toBe('priority');
    expect(updated.date).toBe('2026-09-22');
    expect(updated.time).toBe('18:00');

    const dbEntries = await EntryRepository.getAllEntries();
    const dbUpdated = dbEntries.find(e => e.id === entry.id);
    expect(dbUpdated.text).toBe('Edited task text');
    expect(dbUpdated.type).toBe('event');
  });

  it('reorders entries and updates order_index', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    const itemA = { ...createDailyEntry('Item A', 'task', '2026-09-16'), id: 'item-a' };
    const itemB = { ...createDailyEntry('Item B', 'task', '2026-09-16'), id: 'item-b' };
    await act(async () => {
      await result.current.addEntry(itemA);
      await result.current.addEntry(itemB);
    });

    // Reorder: [itemB, itemA]
    await act(async () => {
      await result.current.reorderEntries([itemB, itemA]);
    });

    const entries = result.current.entries;
    const foundB = entries.find(e => e.id === itemB.id);
    const foundA = entries.find(e => e.id === itemA.id);
    expect(foundB.order_index).toBe(0);
    expect(foundA.order_index).toBe(1);
  });

  it('reorders lists and updates list order', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.addList('List 1');
      await result.current.addList('List 2');
    });

    const [l1, l2] = result.current.lists;
    await act(async () => {
      await result.current.reorderLists([l2, l1]);
    });

    expect(result.current.lists[0].id).toBe(l2.id);
    expect(result.current.lists[1].id).toBe(l1.id);
  });

  it('deletes a list and cascades to all its items', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.addList('Work Projects');
    });

    const listId = result.current.lists[0].id;
    const listItem = {
      id: 'list-item-1',
      text: 'Project Spec',
      type: 'task',
      status: 'open',
      date: '2026-09-16',
      completedAt: null,
      listId: listId,
      order_index: 0,
    };
    const dailyItem = { ...createDailyEntry('Daily task', 'task', '2026-09-16'), id: 'daily-item-1' };

    await act(async () => {
      await result.current.addEntry(listItem);
      await result.current.addEntry(dailyItem);
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.entries).toHaveLength(2);

    await act(async () => {
      await result.current.deleteList(listId);
    });

    expect(result.current.lists).toHaveLength(0);
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe(dailyItem.id);
  });

  it('resets in-memory state with resetJournal', async () => {
    const wrapper = ({ children }) => <JournalProvider>{children}</JournalProvider>;
    const { result } = await renderHook(() => useJournal(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.addList('Groceries');
      await result.current.addEntry(createDailyEntry('Buy apples', 'task', '2026-09-16'));
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.entries).toHaveLength(1);

    await act(async () => {
      result.current.resetJournal();
    });

    expect(result.current.lists).toHaveLength(0);
    expect(result.current.entries).toHaveLength(0);
  });
});
