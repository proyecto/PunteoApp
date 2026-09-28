/**
 * @module EntryRepository
 * @pattern Repository
 *
 * El patrón REPOSITORY actúa como una colección en memoria que abstrae
 * el acceso a los datos persistentes. Las capas superiores (contextos, servicios)
 * trabajan con objetos JS puros y no saben si los datos vienen de SQLite,
 * de una API REST, o de AsyncStorage.
 *
 * Beneficios:
 * - Si mañana se migra de SQLite a una API REST, solo se cambia este archivo.
 * - Las queries SQL complejas están en un solo lugar, no dispersas por la app.
 * - Facilita el testeo: se puede mockear el repositorio para probar la lógica de negocio.
 *
 * Este repositorio gestiona exclusivamente la tabla `entries`.
 */

import db, { runInTransaction } from '../database/db';

/**
 * Obtiene todas las entradas de la base de datos ordenadas por order_index.
 * @returns {Promise<Array<Object>>} Un array de objetos entry ordenados.
 */
export const getAllEntries = async () => {
  return await db.getAllAsync('SELECT * FROM entries ORDER BY order_index ASC, id ASC');
};

/**
 * Obtiene todas las entradas de tipo 'note' sin lista asignada (listId IS NULL),
 * ordenadas por fecha descendente. Son las notas del Daily Log sin procesar.
 * Alimenta la vista "Archivo de Notas" del sistema.
 * @returns {Promise<Array<Object>>} Notas ordenadas por fecha desc.
 */
export const getNoteArchiveEntries = async () => {
  return await db.getAllAsync('SELECT * FROM v_note_archive');
};


/**
 * Inserta una nueva entrada en la base de datos.
 * @param {Object} entry - El objeto entrada a persistir.
 * @param {string} entry.id - ID único (generado por EntryFactory).
 * @param {string} entry.text - El texto de la entrada.
 * @param {string} entry.type - 'task' | 'event' | 'note'.
 * @param {string} entry.status - 'open' | 'completed'.
 * @param {string} entry.date - Fecha en formato 'YYYY-MM-DD'. OBLIGATORIO.
 * @param {string|null} entry.completedAt - Fecha de completado o null.
 * @param {string|null} entry.listId - ID de la lista padre o null.
 * @param {number} [entry.order_index] - Posición en el orden de entradas.
 * @param {string|null} [entry.signifier] - Significador purista ('priority' | 'inspiration' | null).
 * @returns {Promise<void>}
 */
export const insertEntry = async (entry) => {
  await db.runAsync(
    'INSERT INTO entries (id, text, type, status, date, completedAt, listId, order_index, signifier, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      entry.id,
      entry.text,
      entry.type,
      entry.status,
      entry.date,       // Este campo causaba el error NOT NULL antes de la Factory
      entry.completedAt ?? null,
      entry.listId ?? null,
      entry.order_index ?? 0,
      entry.signifier ?? null,
      entry.time ?? null,
    ]
  );
};

/**
 * Actualiza el significador purista (* prioridad / ! inspiración) de una entrada.
 * @param {string} id - ID de la entrada a actualizar.
 * @param {string|null} newSignifier - El nuevo significador ('priority' | 'inspiration' | null).
 * @returns {Promise<void>}
 */
export const updateEntrySignifier = async (id, newSignifier) => {
  await db.runAsync(
    'UPDATE entries SET signifier = ? WHERE id = ?',
    [newSignifier ?? null, id]
  );
};

/**
 * Actualiza la hora específica ('HH:mm' | null) de una entrada.
 * @param {string} id - ID de la entrada.
 * @param {string|null} newTime - La nueva hora en formato 'HH:mm' o null.
 * @returns {Promise<void>}
 */
export const updateEntryTime = async (id, newTime) => {
  await db.runAsync(
    'UPDATE entries SET time = ? WHERE id = ?',
    [newTime ?? null, id]
  );
};

/**
 * Actualiza la fecha y hora de una entrada simultáneamente.
 * @param {string} id - ID de la entrada.
 * @param {string} newDate - La nueva fecha ('YYYY-MM-DD').
 * @param {string|null} newTime - La nueva hora ('HH:mm' | null).
 * @returns {Promise<void>}
 */
export const updateEntryDateTime = async (id, newDate, newTime) => {
  await db.runAsync(
    'UPDATE entries SET date = ?, time = ? WHERE id = ?',
    [newDate, newTime ?? null, id]
  );
};

/**
 * Actualiza los campos editables de una entrada (texto, tipo, significador, fecha, hora).
 * @param {string} id - ID de la entrada.
 * @param {Object} fields - Objeto con { text, type, signifier, date, time }.
 * @returns {Promise<void>}
 */
export const updateEntry = async (id, fields) => {
  const { text, type, signifier, date, time } = fields;
  await db.runAsync(
    'UPDATE entries SET text = ?, type = ?, signifier = ?, date = ?, time = ? WHERE id = ?',
    [text, type, signifier ?? null, date, time ?? null, id]
  );
};

/**
 * Actualiza el order_index de una entrada.
 * @param {string} id - ID de la entrada a actualizar.
 * @param {number} newIndex - El nuevo índice de orden.
 * @returns {Promise<void>}
 */

/**
 * Actualiza el order_index de múltiples entradas en una sola transacción.
 * Esto evita el problema de consultas N+1 al reordenar listas largas.
 * @param {Array<{id: string, newIndex: number}>} updates - Array de actualizaciones.
 * @returns {Promise<void>}
 */
export const updateEntriesOrder = async (updates) => {
  await db.withTransactionAsync(async () => {
    for (const update of updates) {
      await db.runAsync(
        'UPDATE entries SET order_index = ? WHERE id = ?',
        [update.newIndex, update.id]
      );
    }
  });
};

export const updateEntryOrder = async (id, newIndex) => {
  await db.runAsync(
    'UPDATE entries SET order_index = ? WHERE id = ?',
    [newIndex, id]
  );
};

/**
 * Actualiza el estado y la fecha de completado de una entrada.
 * Se usa cuando el usuario pulsa sobre una tarea para marcarla como hecha/pendiente.
 * @param {string} id - ID de la entrada a actualizar.
 * @param {string} newStatus - El nuevo estado ('open' | 'completed').
 * @param {string|null} newCompletedAt - La nueva fecha de completado o null.
 * @returns {Promise<void>}
 */
export const updateEntryStatus = async (id, newStatus, newCompletedAt) => {
  await db.runAsync(
    'UPDATE entries SET status = ?, completedAt = ? WHERE id = ?',
    [newStatus, newCompletedAt, id]
  );
};

/**
 * Elimina todas las entradas que pertenecen a una lista específica.
 * Se usa como operación previa al borrar la lista padre (integridad referencial manual).
 * SQLite sin Foreign Keys activadas no hace esto automáticamente.
 * @param {string} listId - ID de la lista cuyas entradas se borrarán.
 * @returns {Promise<void>}
 */
export const deleteEntriesByListId = async (listId) => {
  await db.runAsync('DELETE FROM entries WHERE listId = ?', [listId]);
};

/**
 * Elimina una única entrada por su ID.
 * @param {string} id - ID de la entrada a eliminar.
 * @returns {Promise<void>}
 */
export const deleteEntryById = async (id) => {
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
};

/**
 * Actualiza la fecha de una entrada.
 * Se usa para migrar tareas (ej: mover una tarea del mes a un día concreto).
 * @param {string} id - ID de la entrada.
 * @param {string} newDate - La nueva fecha en formato 'YYYY-MM-DD' o 'YYYY-MM'.
 * @returns {Promise<void>}
 */
export const updateEntryDate = async (id, newDate) => {
  await db.runAsync(
    'UPDATE entries SET date = ? WHERE id = ?',
    [newDate, id]
  );
};

/**
 * Actualiza el orden de múltiples entradas dentro de una única transacción atómica.
 * Reemplaza bucles secuenciales lentos por una operación atómica en SQLite.
 * @param {Array<{id: string, order_index?: number}>} entriesWithNewOrder - Array de entradas ordenadas.
 * @returns {Promise<void>}
 */
export const batchUpdateEntryOrders = async (entriesWithNewOrder) => {
  if (!entriesWithNewOrder || entriesWithNewOrder.length === 0) return;
  await runInTransaction(async () => {
    if (entriesWithNewOrder.length <= 50) {
      const ids = entriesWithNewOrder.map((e) => e.id);
      const caseClauses = entriesWithNewOrder.map(() => 'WHEN id = ? THEN ?').join(' ');
      const placeholders = ids.map(() => '?').join(',');
      const sql = `UPDATE entries SET order_index = CASE ${caseClauses} END WHERE id IN (${placeholders})`;

      const pairs = [];
      entriesWithNewOrder.forEach((e, idx) => {
        const order = e.order_index !== undefined ? e.order_index : idx;
        pairs.push(e.id, order);
      });

      const params = [...pairs, ...ids];
      await db.runAsync(sql, params);
    } else {
      for (let i = 0; i < entriesWithNewOrder.length; i++) {
        const item = entriesWithNewOrder[i];
        const newIndex = item.order_index !== undefined ? item.order_index : i;
        await db.runAsync('UPDATE entries SET order_index = ? WHERE id = ?', [newIndex, item.id]);
      }
    }
  });
};

/**
 * Inserta múltiples entradas dentro de una única transacción atómica.
 * Esencial para importaciones rápidas de copias de seguridad.
 * @param {Array<Object>} entries - Array de objetos entrada.
 * @returns {Promise<void>}
 */
export const batchInsertEntries = async (entries) => {
  if (!entries || entries.length === 0) return;
  await runInTransaction(async () => {
    for (const entry of entries) {
      await db.runAsync(
        'INSERT INTO entries (id, text, type, status, date, completedAt, listId, order_index, signifier, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          entry.id,
          entry.text,
          entry.type,
          entry.status,
          entry.date,
          entry.completedAt ?? null,
          entry.listId ?? null,
          entry.order_index ?? 0,
          entry.signifier ?? null,
          entry.time ?? null,
        ]
      );
    }
  });
};
