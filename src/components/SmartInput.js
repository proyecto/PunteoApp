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
  const pendingVoiceSubmitRef = useRef(false);
  const hasSubmittedVoiceRef = useRef(false);
  const submittedVoiceTextRef = useRef('');
  const installedLocalesRef = useRef([]);

  // Pre-solicitar permisos y consultar idiomas instalados en el teléfono
  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((result) => {
        permissionsGrantedRef.current = !!result?.granted;
      })
      .catch(() => {
        permissionsGrantedRef.current = false;
      });

    try {
      if (typeof ExpoSpeechRecognitionModule.getSupportedLocales === 'function') {
        ExpoSpeechRecognitionModule.getSupportedLocales({})
          .then((res) => {
            const list = res.installedLocales?.length ? res.installedLocales : res.locales || [];
            installedLocalesRef.current = list;
          })
          .catch(() => {});
      }
    } catch (e) {}
  }, []);

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

  // Escuchar resultados de reconocimiento de voz
  useSpeechRecognitionEvent('result', (event) => {
    const res = event.results[0];
    const text = res?.transcript;
    if (text) {
      setTranscript(text);
      transcriptRef.current = text;

      // Si el usuario ya soltó el botón de grabar pero aún no se había enviado (esperando resultado final)
      const trimmed = text.trim();
      if (pendingVoiceSubmitRef.current && !hasSubmittedVoiceRef.current && trimmed) {
        hasSubmittedVoiceRef.current = true;
        pendingVoiceSubmitRef.current = false;
        submittedVoiceTextRef.current = trimmed;
        handleSubmit(trimmed, { isVoice: true });
      }
    }
  });

  // Escuchar errores de reconocimiento de voz
  useSpeechRecognitionEvent('error', (event) => {
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

  const handleModalShow = () => {
    focusTimerRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

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
      } catch (e) {}

      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {}

      if (shouldSubmit && !hasSubmittedVoiceRef.current) {
        const currentText = transcriptRef.current?.trim();
        if (currentText) {
          hasSubmittedVoiceRef.current = true;
          pendingVoiceSubmitRef.current = false;
          submittedVoiceTextRef.current = currentText;
          handleSubmit(currentText, { isVoice: true });
        } else {
          // Si no hay texto aún al soltar el botón, esperamos un resultado final durante un breve margen
          pendingVoiceSubmitRef.current = true;
          setTimeout(() => {
            if (pendingVoiceSubmitRef.current && !hasSubmittedVoiceRef.current) {
              const finalText = transcriptRef.current?.trim();
              if (finalText) {
                hasSubmittedVoiceRef.current = true;
                submittedVoiceTextRef.current = finalText;
                handleSubmit(finalText, { isVoice: true });
              }
              pendingVoiceSubmitRef.current = false;
            }
          }, 500);
        }
      }
    },
    [handleSubmit]
  );

  const getBestLanguageCode = () => {
    const list = installedLocalesRef.current;
    if (language === 'es') {
      if (list.includes('es-ES')) return 'es-ES';
      if (list.includes('es-US')) return 'es-US';
      if (list.includes('es-MX')) return 'es-MX';
      const anyEs = list.find((l) => l.startsWith('es'));
      if (anyEs) return anyEs;
      return 'es-ES';
    }
    return 'en-US';
  };

  const startRecording = async () => {
    setIsRecording(true);
    isRecordingRef.current = true;
    pendingVoiceSubmitRef.current = false;
    hasSubmittedVoiceRef.current = false;
    submittedVoiceTextRef.current = '';
    setRecordingSeconds(0);
    setTranscript('');
    transcriptRef.current = '';

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

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
            ? 'Se requiere permiso de micrófono para realizar dictado de voz.'
            : 'Microphone permission is required to perform voice dictation.'
        );
        return;
      }

      if (!isRecordingRef.current) return;

      const targetLang = getBestLanguageCode();

      let servicePackage;
      try {
        if (typeof ExpoSpeechRecognitionModule.getSpeechRecognitionServices === 'function') {
          const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
          if (Array.isArray(services) && services.includes('com.google.android.as')) {
            servicePackage = 'com.google.android.as';
          }
        }
      } catch (e) {}

      ExpoSpeechRecognitionModule.start({
        lang: targetLang,
        interimResults: true,
        maxAlternatives: 2,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        androidIntent: 'android.speech.action.RECOGNIZE_SPEECH',
        androidRecognitionServicePackage: servicePackage,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
        },
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
      stopRecording(true);
    } else if (pressDuration < 200 && !value?.trim()) {
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
                  ? theme.primary
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
                            ? theme.primary
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
