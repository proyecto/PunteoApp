/**
 * @module SmartInput
 * @description Componente de entrada de texto estilo Bottom Sheet Modal para React Native / Expo.
 * 
 * Muestra una barra visible en la parte inferior de la pantalla. Al pulsarla, abre un Modal
 * nativo con fondo atenuado y el input flotando exactamente sobre el teclado virtual.
 * 
 * Si el campo de texto está vacío:
 * - Un toque rápido (< 200ms) abre el teclado para escribir normalmente.
 * - Mantener pulsado (> 200ms) activa la grabación de voz nativa y offline (máx 10s).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useSettings } from '../context/SettingsContext';
import { AppText as Text } from './Typography';

export default function SmartInput({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  topContent,
  leftContent,
}) {
  const { theme, language } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');

  const inputRef = useRef(null);
  const focusTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const startDelayTimerRef = useRef(null);
  const pressStartTimeRef = useRef(0);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const permissionsGrantedRef = useRef(false);

  // Pre-solicitar permisos en segundo plano al montar el componente
  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((result) => {
        permissionsGrantedRef.current = !!result?.granted;
      })
      .catch(() => {
        permissionsGrantedRef.current = false;
      });
  }, []);

  // Escuchar resultados de reconocimiento de voz
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      setTranscript(text);
      transcriptRef.current = text;
    }
  });

  // Escuchar errores de reconocimiento de voz
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech recognition event error:', event.error, event.message);

    // Ignorar pausas de silencio iniciales no destructivas en Android
    if (event.error === 'no-speech' || event.error === 'speech-timeout') {
      return;
    }

    if (isRecordingRef.current) {
      const isFatal = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      stopRecording(false);
      if (isFatal) {
        Alert.alert(
          language === 'es' ? 'Permiso de micrófono' : 'Microphone Permission',
          language === 'es'
            ? `Reconocimiento de voz no disponible (${event.error}: ${event.message || ''})`
            : `Voice recognition unavailable (${event.error}: ${event.message || ''})`
        );
      }
    }
  });

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }
    Keyboard.dismiss();
    setIsOpen(false);
  }, []);

  const handleModalShow = () => {
    focusTimerRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const handleSubmit = useCallback(
    (textOverride = null, options = {}) => {
      const textToSend = typeof textOverride === 'string' ? textOverride : value;
      if (!textToSend?.trim()) return;

      if (typeof onSubmit === 'function') {
        onSubmit(textToSend, options);
      }
      handleClose();
    },
    [value, onSubmit, handleClose]
  );

  const stopRecording = useCallback(
    (shouldSubmit = true) => {
      if (startDelayTimerRef.current) {
        clearTimeout(startDelayTimerRef.current);
        startDelayTimerRef.current = null;
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (!isRecordingRef.current) return;

      setIsRecording(false);
      isRecordingRef.current = false;

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Ignorar en entornos sin haptics
      }

      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        // Ignorar si ya se había detenido
      }

      if (shouldSubmit) {
        const finalText = transcriptRef.current?.trim();
        if (finalText) {
          handleSubmit(finalText, { isVoice: true });
        }
      }

      setTranscript('');
      transcriptRef.current = '';
      setRecordingSeconds(0);
    },
    [handleSubmit]
  );

  const startRecording = async () => {
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecordingSeconds(0);
    setTranscript('');
    transcriptRef.current = '';

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Ignorar si no está soportado
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    let elapsed = 0;
    recordingTimerRef.current = setInterval(() => {
      elapsed += 1;
      setRecordingSeconds(elapsed);
      if (elapsed >= 10) {
        stopRecording(true);
      }
    }, 1000);

    try {
      if (!permissionsGrantedRef.current) {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        permissionsGrantedRef.current = !!result?.granted;
      }

      if (!permissionsGrantedRef.current) {
        stopRecording(false);
        Alert.alert(
          language === 'es' ? 'Permiso denegado' : 'Permission denied',
          language === 'es'
            ? 'Se requiere permiso de micrófono para realizar búsquedas o dictado de voz.'
            : 'Microphone permission is required to perform voice dictation.'
        );
        return;
      }

      if (!isRecordingRef.current) return;

      ExpoSpeechRecognitionModule.start({
        lang: language === 'es' ? 'es-ES' : 'en-US',
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch (err) {
      console.warn('Error starting voice recording:', err);
      stopRecording(false);
      Alert.alert(
        language === 'es' ? 'Error de voz' : 'Voice Error',
        err?.message || String(err)
      );
    }
  };

  const handlePressIn = () => {
    if (value?.trim()) return;

    pressStartTimeRef.current = Date.now();

    if (startDelayTimerRef.current) {
      clearTimeout(startDelayTimerRef.current);
    }

    // Umbral de 200ms para diferenciar toque rápido de pulsación larga
    startDelayTimerRef.current = setTimeout(() => {
      startRecording();
    }, 200);
  };

  const handlePressOut = () => {
    const pressDuration = Date.now() - pressStartTimeRef.current;

    if (startDelayTimerRef.current) {
      clearTimeout(startDelayTimerRef.current);
      startDelayTimerRef.current = null;
    }

    if (isRecordingRef.current) {
      // Si estuvo grabando (>200ms), detener y enviar
      stopRecording(true);
    } else if (pressDuration < 200 && !value?.trim()) {
      // Si fue un toque corto (<200ms), abrir modal para escribir
      handleOpen();
    }
  };

  const handleButtonPress = () => {
    if (value?.trim()) {
      handleSubmit();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (startDelayTimerRef.current) {
        clearTimeout(startDelayTimerRef.current);
      }
    };
  }, []);

  // Cierra automáticamente el modal cuando se oculta el teclado
  useEffect(() => {
    if (!isOpen) return;

    let keyboardHasShown = false;

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardHasShown = true;
    });

    const safetyTimer = setTimeout(() => {
      keyboardHasShown = true;
    }, 400);

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (keyboardHasShown && !isRecordingRef.current) {
        handleClose();
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isOpen, handleClose]);

  const defaultPlaceholder = language === 'es' ? 'Escribe aquí...' : 'Type here...';
  const hasText = !!value?.trim();

  const getRecordingLabel = () => {
    const secStr = `${recordingSeconds}s / 10s`;
    if (transcript) {
      return `🔴 ${transcript} (${secStr})`;
    }
    return language === 'es' ? `🔴 Grabando... (${secStr})` : `🔴 Recording... (${secStr})`;
  };

  return (
    <>
      {/* ─── 1. BARRA VISIBLE EN EL LAYOUT (DUMMY) ─── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpen}
        style={[
          styles.dummyContainer,
          {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        ]}
      >
        {topContent && (
          <View style={styles.topContentContainer}>
            {topContent}
          </View>
        )}

        <View style={styles.inputRow}>
          {leftContent && (
            <View style={styles.leftContentContainer}>
              {leftContent}
            </View>
          )}

          <View
            style={[
              styles.dummyTextInput,
              {
                backgroundColor: isRecording ? '#FFEBEE' : theme.inputBackground,
              },
            ]}
          >
            <Text
              style={{
                color: isRecording ? '#D32F2F' : value ? theme.text : theme.textSecondary,
                fontSize: 16,
                fontWeight: isRecording ? '600' : '400',
              }}
              numberOfLines={1}
            >
              {isRecording
                ? getRecordingLabel()
                : value || placeholder || defaultPlaceholder}
            </Text>
          </View>

          <Pressable
            style={[
              styles.sendButton,
              {
                backgroundColor: isRecording
                  ? '#E53935'
                  : hasText
                  ? theme.text
                  : theme.buttonBackground,
              },
            ]}
            onPress={hasText ? handleButtonPress : undefined}
            onPressIn={!hasText ? handlePressIn : undefined}
            onPressOut={!hasText ? handlePressOut : undefined}
            accessibilityLabel={
              hasText
                ? language === 'es' ? 'Enviar' : 'Send'
                : language === 'es' ? 'Mantener para grabar por voz' : 'Hold to record voice'
            }
          >
            <Ionicons
              name={hasText ? 'arrow-up' : 'mic'}
              size={20}
              color={theme.cardBackground}
            />
          </Pressable>
        </View>
      </TouchableOpacity>

      {/* ─── 2. MODAL NATIVO FLOTANTE SOBRE EL TECLADO ─── */}
      <Modal
        testID="smart-input-modal"
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
        onShow={handleModalShow}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={isRecording ? undefined : handleClose}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior="padding"
              style={styles.keyboardAvoidingView}
            >
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.modalInputCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderTopColor: theme.border,
                    },
                  ]}
                >
                  {topContent && (
                    <View style={styles.topContentContainer}>
                      {topContent}
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    {leftContent && (
                      <View style={styles.leftContentContainer}>
                        {leftContent}
                      </View>
                    )}

                    <TextInput
                      ref={inputRef}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isRecording ? '#FFEBEE' : theme.inputBackground,
                          color: isRecording ? '#D32F2F' : theme.text,
                        },
                      ]}
                      placeholder={
                        isRecording
                          ? getRecordingLabel()
                          : placeholder || defaultPlaceholder
                      }
                      placeholderTextColor={isRecording ? '#D32F2F' : theme.textSecondary}
                      value={isRecording ? transcript : value}
                      onChangeText={onChangeText}
                      onSubmitEditing={() => handleSubmit()}
                      returnKeyType="send"
                      editable={!isRecording}
                    />

                    <Pressable
                      style={[
                        styles.sendButton,
                        {
                          backgroundColor: isRecording
                            ? '#E53935'
                            : hasText
                            ? theme.text
                            : theme.buttonBackground,
                        },
                        hasText || isRecording ? { elevation: 3 } : null,
                      ]}
                      onPress={hasText ? handleButtonPress : undefined}
                      onPressIn={!hasText ? handlePressIn : undefined}
                      onPressOut={!hasText ? handlePressOut : undefined}
                      accessibilityLabel={
                        hasText
                          ? language === 'es' ? 'Enviar' : 'Send'
                          : language === 'es' ? 'Mantener para grabar por voz' : 'Hold to record voice'
                      }
                    >
                      <Ionicons
                        name={hasText ? 'arrow-up' : 'mic'}
                        size={20}
                        color={theme.cardBackground}
                      />
                    </Pressable>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dummyContainer: {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalInputCard: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  topContentContainer: {
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftContentContainer: {
    marginRight: 10,
  },
  dummyTextInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
