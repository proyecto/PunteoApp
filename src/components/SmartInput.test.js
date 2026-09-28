import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import SmartInput from './SmartInput';
import { SettingsProvider } from '../context/SettingsContext';

const renderSmartInput = async (props = {}) => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    onSubmit: jest.fn(),
    placeholder: 'Escribe aquí...',
    ...props,
  };

  const rendered = await render(
    <SettingsProvider>
      <SmartInput {...defaultProps} />
    </SettingsProvider>
  );

  await rendered.findByText(defaultProps.value || defaultProps.placeholder || 'Escribe aquí...');

  return {
    ...rendered,
    props: defaultProps,
  };
};

describe('SmartInput Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dummy input bar with placeholder', async () => {
    const { getByText } = await renderSmartInput({ placeholder: 'Añadir nueva tarea...' });
    expect(getByText('Añadir nueva tarea...')).toBeTruthy();
  });

  it('opens modal on pressing dummy container', async () => {
    const { getByText, getByTestId } = await renderSmartInput({ placeholder: 'Abrir modal' });

    const dummyBar = getByText('Abrir modal');
    await act(async () => {
      fireEvent.press(dummyBar);
    });

    const modal = getByTestId('smart-input-modal');
    expect(modal.props.visible).toBe(true);
  });

  it('calls onChangeText when typing inside modal text input', async () => {
    const onChangeText = jest.fn();
    const { getByText, getByPlaceholderText } = await renderSmartInput({
      placeholder: 'Nueva tarea',
      onChangeText,
    });

    // Open modal
    await act(async () => {
      fireEvent.press(getByText('Nueva tarea'));
    });

    const input = getByPlaceholderText('Nueva tarea');
    fireEvent.changeText(input, 'Comprar leche');

    expect(onChangeText).toHaveBeenCalledWith('Comprar leche');
  });

  it('calls onSubmit when clicking send button with text', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByTestId, queryByTestId, getByPlaceholderText } = await renderSmartInput({
      value: 'Comprar pan',
      placeholder: 'Escribe algo',
      onSubmit,
    });

    // Open modal
    await act(async () => {
      fireEvent.press(getByText('Comprar pan'));
    });

    const modal = getByTestId('smart-input-modal');
    expect(modal.props.visible).toBe(true);

    // Press submit editing on input
    const input = getByPlaceholderText('Escribe algo');
    await act(async () => {
      fireEvent(input, 'submitEditing');
    });

    expect(onSubmit).toHaveBeenCalled();
    expect(queryByTestId('smart-input-modal')).toBeNull();
  });

  it('closes modal when keyboardDidHide event is fired (Android back button)', async () => {
    let hideCallback = null;
    let showCallback = null;

    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, cb) => {
      if (eventName === 'keyboardDidHide') hideCallback = cb;
      if (eventName === 'keyboardDidShow') showCallback = cb;
      return { remove: jest.fn() };
    });

    const { getByText, getByTestId, queryByTestId } = await renderSmartInput({ placeholder: 'Android back test' });

    // Open modal
    await act(async () => {
      fireEvent.press(getByText('Android back test'));
    });

    expect(getByTestId('smart-input-modal')).toBeTruthy();

    // Simulate keyboard showing and then hiding (Android back button)
    await act(async () => {
      if (showCallback) showCallback();
      if (hideCallback) hideCallback();
    });

    expect(queryByTestId('smart-input-modal')).toBeNull();
  });

  it('renders microphone icon button when input text is empty', async () => {
    const { getByLabelText } = await renderSmartInput({ value: '' });
    expect(getByLabelText('Mantener para grabar por voz')).toBeTruthy();
  });

  it('renders send arrow button when input text is non-empty', async () => {
    const { getByLabelText } = await renderSmartInput({ value: 'Nueva tarea' });
    expect(getByLabelText('Enviar')).toBeTruthy();
  });
});
