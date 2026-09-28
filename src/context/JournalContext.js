/**
 * @module JournalContext
 * @pattern Facade + Observer
 *
 * FACADE: Este módulo expone una API simple y unificada a las pantallas de la app.
 * Internamente coordina EntryRepository, ListRepository y EntryFactory,
 * pero las pantallas solo ven funciones de alto nivel como `addEntry()` o `deleteList()`.
 * Si la implementación interna cambia (p.ej: se añade caché), la API pública no cambia.
 *
 * OBSERVER: El patrón Observer está implementado mediante React Context + useState.
 * Los componentes suscritos (via `useJournal()`) son notificados automáticamente
 * cuando el estado cambia, sin necesidad de polling ni eventos manuales.
 *
 * @example
 * // En cualquier pantalla o componente:
 * const { entries, addEntry } = useJournal();
 */

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import * as EntryRepository from '../repositories/EntryRepository';
import * as ListRepository from '../repositories/ListRepository';
import { createList } from '../factories/EntryFactory';
// Re-exportamos getFormattedDate desde su módulo utilitario para que los
// consumidores que ya importaban desde JournalContext sigan funcionando sin cambios.
export { getFormattedDate } from '../utils/dateUtils';

// ─── Contexto (Observer) ──────────────────────────────────────────────────────

/**
 * El contexto React que actúa como el "canal de comunicación" del patrón Observer.
 * Los componentes suscritos via `useJournal()` se re-renderizan automáticamente
 * cuando cualquier valor del Provider cambia.
 */
const JournalContext = createContext();

// ─── Provider (Facade) ────────────────────────────────────────────────────────

/**
 * El proveedor del contexto. Envuelve a los componentes que necesitan
 * acceso al estado del diario. Debe colocarse en lo alto del árbol de componentes.
 *
 * @param {React.ReactNode} children - Los componentes hijos que tendrán acceso al contexto.
 */
export const JournalProvider = ({ children }) => {
  // Estado en memoria de la app (la "caché" de lo que hay en SQLite)
  const [entries, setEntries] = useState([]);
  const [lists,   setLists]   = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  /**
   * Carga inicial de datos desde SQLite al arrancar la app.
   * Se ejecuta una sola vez gracias al array de dependencias vacío `[]`.
   * El flag `isLoaded` evita que la app se renderice antes de tener datos.
   */
  useEffect(() => {
    const loadJournal = async () => {
      try {
        const [loadedLists, loadedEntries] = await Promise.all([
          ListRepository.getAllLists(),
          EntryRepository.getAllEntries(),
        ]);
        setLists(loadedLists);
        setEntries(loadedEntries);
      } catch (e) {
        console.error('[JournalContext] Error cargando datos de SQLite:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadJournal();
  }, []);

  // ─── Métodos de la Facade (API Pública Memoizada) ────────────────────────────

  /**
   * Añade una nueva entrada al diario.
   */
  const addEntry = useCallback(async (entry) => {
    try {
      await EntryRepository.insertEntry(entry);
      // Actualización optimista: añadimos al estado sin re-consultar la BD
      setEntries(prev => [...prev, entry]);
    } catch (e) {
      console.error('[JournalContext] Error al añadir entrada:', e);
    }
  }, []);

  /**
   * Añade una nueva lista de usuario.
   */
  const addList = useCallback(async (title) => {
    try {
      setLists(prev => {
        const newList = createList(title, prev.length);
        ListRepository.insertList(newList).catch(e => {
          console.error('[JournalContext] Error al añadir lista en SQLite:', e);
        });
        return [...prev, newList];
      });
    } catch (e) {
      console.error('[JournalContext] Error al añadir lista:', e);
    }
  }, []);

  /**
   * Persiste el nuevo orden de las listas tras un drag & drop usando una transacción en lote.
   */
  const reorderLists = useCallback(async (newOrder) => {
    setLists(newOrder);
    try {
      await ListRepository.batchUpdateListOrders(newOrder);
    } catch (e) {
      console.error('[JournalContext] Error al reordenar listas:', e);
    }
  }, []);

  /**
   * Elimina una lista y sus entradas asociadas.
   */
  const deleteList = useCallback(async (id) => {
    try {
      await EntryRepository.deleteEntriesByListId(id);
      await ListRepository.deleteList(id);
      setLists(prev => prev.filter(list => list.id !== id));
      setEntries(prev => prev.filter(entry => entry.listId !== id));
    } catch (e) {
      console.error('[JournalContext] Error al eliminar lista:', e);
    }
  }, []);

  /**
   * Alterna el estado de completado de una tarea.
   */
  const toggleStatus = useCallback(async (id, currentLogDate) => {
    setEntries(prev => {
      const entry = prev.find(e => e.id === id);
      if (!entry || (entry.type !== 'task' && entry.type !== 'event')) return prev;

      const isCompleting    = entry.status === 'open';
      const newStatus       = isCompleting ? 'completed' : 'open';
      const newCompletedAt  = isCompleting ? currentLogDate : null;

      EntryRepository.updateEntryStatus(id, newStatus, newCompletedAt).catch(e => {
        console.error('[JournalContext] Error al cambiar estado de tarea:', e);
      });

      return prev.map(e => e.id === id ? { ...e, status: newStatus, completedAt: newCompletedAt } : e);
    });
  }, []);

  /**
   * Elimina una entrada del diario por su ID.
   */
  const deleteEntry = useCallback(async (id) => {
    try {
      await EntryRepository.deleteEntryById(id);
      setEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (e) {
      console.error('[JournalContext] Error al eliminar entrada:', e);
    }
  }, []);

  /**
   * Actualiza la fecha de una entrada (usado para migración).
   */
  const updateEntryDate = useCallback(async (id, newDate) => {
    try {
      await EntryRepository.updateEntryDate(id, newDate);
      setEntries(prev =>
        prev.map(entry => entry.id === id ? { ...entry, date: newDate } : entry)
      );
    } catch (e) {
      console.error('[JournalContext] Error al actualizar fecha de entrada:', e);
    }
  }, []);

  /**
   * Actualiza la hora específica ('HH:mm' | null) de una entrada.
   */
  const updateEntryTime = useCallback(async (id, newTime) => {
    try {
      await EntryRepository.updateEntryTime(id, newTime);
      setEntries(prev =>
        prev.map(entry => entry.id === id ? { ...entry, time: newTime } : entry)
      );
    } catch (e) {
      console.error('[JournalContext] Error al actualizar hora de entrada:', e);
    }
  }, []);

  /**
   * Actualiza la fecha y la hora de una entrada simultáneamente.
   */
  /**
   * Actualiza la fecha y la hora de una entrada simultáneamente.
   */
  const updateEntryDateTime = useCallback(async (id, newDate, newTime) => {
    try {
      await EntryRepository.updateEntryDateTime(id, newDate, newTime);
      setEntries(prev =>
        prev.map(entry => entry.id === id ? { ...entry, date: newDate, time: newTime } : entry)
      );
    } catch (e) {
      console.error('[JournalContext] Error al actualizar fecha y hora de entrada:', e);
    }
  }, []);

  /**
   * Actualiza los campos editables de una entrada (texto, tipo, significador, fecha, hora).
   */
  const updateEntry = useCallback(async (id, fields) => {
    try {
      await EntryRepository.updateEntry(id, fields);
      setEntries(prev =>
        prev.map(entry => entry.id === id ? { ...entry, ...fields } : entry)
      );
    } catch (e) {
      console.error('[JournalContext] Error al actualizar entrada:', e);
    }
  }, []);

  /**
   * Persiste el nuevo orden de un subconjunto de entradas dentro de una única transacción.
   */
  const reorderEntries = useCallback(async (reorderedSubset) => {
    const reorderedWithIndexes = reorderedSubset.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    const reorderedIds = new Set(reorderedWithIndexes.map(e => e.id));

    // Actualización optimista del estado
    setEntries(prev => {
      const rest = prev.filter(e => !reorderedIds.has(e.id));
      return [...rest, ...reorderedWithIndexes];
    });

    try {
      await EntryRepository.batchUpdateEntryOrders(reorderedWithIndexes);
    } catch (e) {
      console.error('[JournalContext] Error al reordenar entradas:', e);
    }
  }, []);

  /**
   * Alterna el significador purista de una entrada en orden cíclico.
   */
  const toggleSignifier = useCallback(async (id) => {
    setEntries(prev => {
      const entry = prev.find(e => e.id === id);
      if (!entry) return prev;

      let nextSignifier = null;
      if (!entry.signifier) {
        nextSignifier = 'priority';
      } else if (entry.signifier === 'priority') {
        nextSignifier = 'inspiration';
      } else {
        nextSignifier = null;
      }

      EntryRepository.updateEntrySignifier(id, nextSignifier).catch(e => {
        console.error('[JournalContext] Error al cambiar significador:', e);
      });

      return prev.map(e => e.id === id ? { ...e, signifier: nextSignifier } : e);
    });
  }, []);

  /**
   * Establece directamente un significador para una entrada.
   */
  const setSignifier = useCallback(async (id, signifier) => {
    try {
      await EntryRepository.updateEntrySignifier(id, signifier);
      setEntries(prev =>
        prev.map(e => e.id === id ? { ...e, signifier } : e)
      );
    } catch (e) {
      console.error('[JournalContext] Error al establecer significador:', e);
    }
  }, []);

  const reloadJournalData = useCallback(async () => {
    try {
      const [loadedLists, loadedEntries] = await Promise.all([
        ListRepository.getAllLists(),
        EntryRepository.getAllEntries(),
      ]);
      setLists(loadedLists);
      setEntries(loadedEntries);
    } catch (e) {
      console.error('[JournalContext] Error recargando datos:', e);
    }
  }, []);

  const resetJournal = useCallback(() => {
    setEntries([]);
    setLists([]);
  }, []);

  // Objeto de contexto memoizado: evita re-renderizar consumidores innecesariamente
  const contextValue = useMemo(() => ({
    entries,
    addEntry,
    toggleStatus,
    toggleSignifier,
    setSignifier,
    deleteEntry,
    updateEntryDate,
    updateEntryTime,
    updateEntryDateTime,
    updateEntry,
    reorderEntries,
    lists,
    addList,
    reorderLists,
    deleteList,
    resetJournal,
    reloadJournalData,
  }), [
    entries,
    lists,
    addEntry,
    toggleStatus,
    toggleSignifier,
    setSignifier,
    deleteEntry,
    updateEntryDate,
    updateEntryTime,
    updateEntryDateTime,
    updateEntry,
    reorderEntries,
    addList,
    reorderLists,
    deleteList,
    resetJournal,
    reloadJournalData,
  ]);

  // Mientras los datos de SQLite no se han cargado, no renderizamos nada.
  // Esto evita un flash de contenido vacío al arrancar la app.
  if (!isLoaded) return null;

  return (
    <JournalContext.Provider value={contextValue}>
      {children}
    </JournalContext.Provider>
  );
};

// ─── Hook personalizado ───────────────────────────────────────────────────────

/**
 * Hook de acceso al JournalContext.
 * Usar este hook (en lugar de `useContext(JournalContext)` directamente) añade
 * validación: lanza un error descriptivo si se usa fuera del Provider.
 *
 * @returns {Object} El valor del contexto con { entries, addEntry, toggleStatus, lists, ... }
 * @throws {Error} Si se usa fuera de un JournalProvider.
 */
export const useJournal = () => {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error('[useJournal] Debe usarse dentro de un <JournalProvider>.');
  }
  return context;
};
