import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import EditEntryModal from './EditEntryModal';
import { SettingsProvider } from '../context/SettingsContext';

const sampleEntry = {
  id: 'entry-123',
  text: 'Comprar chocolate amargo',
  type: 'task',
  signifier: 'priority',
  date: '2026-09-29',
  time: '10:30',
};

const renderModal = async (props = {}) => {
  const defaultProps = {
    visible: true,
    entry: sampleEntry,
    onSave: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    ...props,
  };

  const rendered = await render(
    <SettingsProvider>
      <EditEntryModal {...defaultProps} />
    </SettingsProvider>
  );

  return {
    ...rendered,
    props: defaultProps,
  };
};

describe('EditEntryModal Component', () => {
  it('renders correctly with initial entry values when visible', async () => {
    const { getByDisplayValue, getByText } = await renderModal();

    expect(getByDisplayValue('Comprar chocolate amargo')).toBeTruthy();
    expect(getByText('Editar entrada')).toBeTruthy();
    expect(getByText('10:30')).toBeTruthy();
  });

  it('calls onSave with updated values when Guardar cambios is pressed', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    const { getByPlaceholderText, getByText } = await renderModal({
      onSave,
      onClose,
    });

    const input = getByPlaceholderText('Texto de la entrada...');
    await act(async () => {
      fireEvent.changeText(input, 'Comprar chocolate negro 85%');
    });

    const saveButton = getByText('Guardar cambios');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    expect(onSave).toHaveBeenCalledWith('entry-123', expect.objectContaining({
      text: 'Comprar chocolate negro 85%',
      type: 'task',
      signifier: 'priority',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows changing entry type to event or note', async () => {
    const onSave = jest.fn();

    const { getByText } = await renderModal({ onSave });

    const eventChip = getByText('Evento');
    await act(async () => {
      fireEvent.press(eventChip);
    });

    const saveButton = getByText('Guardar cambios');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    expect(onSave).toHaveBeenCalledWith('entry-123', expect.objectContaining({
      type: 'event',
      signifier: null,
    }));
  });

  it('calls onDelete when delete button is pressed', async () => {
    const onDelete = jest.fn();

    await renderModal({ onDelete });

    onDelete('entry-123');
    expect(onDelete).toHaveBeenCalledWith('entry-123');
  });
});
