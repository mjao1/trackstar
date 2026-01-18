import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
  Modal,
  Image,
} from 'react-native';
import { useRouter, Href, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import {
  getDeviceStatus,
  setDeviceState,
  setAlarm,
  getMotionEvents,
  Device,
  DeviceState,
  MotionEvent,
} from '@/lib/api';

export default function WatchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [device, setDevice] = useState<Device | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const ripple4 = useRef(new Animated.Value(0)).current;
  const ripple5 = useRef(new Animated.Value(0)).current;

  // Pulse animation for status indicator dot
  useEffect(() => {
    if (device) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [device]);

  // Scale pulse animation for main watch button
  const buttonAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  
  useEffect(() => {
    if (device && !buttonAnimationRef.current) {
      const scalePulse = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonScaleAnim, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(buttonScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      buttonAnimationRef.current = scalePulse;
      scalePulse.start();
    }
    
    return () => {
      if (buttonAnimationRef.current) {
        buttonAnimationRef.current.stop();
        buttonAnimationRef.current = null;
      }
    };
  }, [!!device]);

  // Watch animation with afterimage effect
  useEffect(() => {
    if (device?.state === 'WATCH') {
      const createRipple = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      const rippleAnimation = Animated.parallel([
        createRipple(ripple1, 0),
        createRipple(ripple2, 360),
        createRipple(ripple3, 720),
        createRipple(ripple4, 1080),
        createRipple(ripple5, 1440),
      ]);
      
      rippleAnimation.start();
      
      return () => {
        rippleAnimation.stop();
        ripple1.setValue(0);
        ripple2.setValue(0);
        ripple3.setValue(0);
        ripple4.setValue(0);
        ripple5.setValue(0);
      };
    }
  }, [device?.state]);

  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmedNotMe, setConfirmedNotMe] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  
  // Red pulse animation for theft detected
  const alertPulseAnim = useRef(new Animated.Value(1)).current;
  const alertRipple1 = useRef(new Animated.Value(0)).current;
  const alertRipple2 = useRef(new Animated.Value(0)).current;
  const alertRipple3 = useRef(new Animated.Value(0)).current;
  const alertRipple4 = useRef(new Animated.Value(0)).current;
  const alertRipple5 = useRef(new Animated.Value(0)).current;
  
  // Theft detected animation - scale pulse and ripple effects
  useEffect(() => {
    if (device?.state === 'THEFT_DETECTED') {
      const scalePulse = Animated.loop(
        Animated.sequence([
          Animated.timing(alertPulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(alertPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      
      const createRipple = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      const rippleAnimation = Animated.parallel([
        createRipple(alertRipple1, 0),
        createRipple(alertRipple2, 360),
        createRipple(alertRipple3, 720),
        createRipple(alertRipple4, 1080),
        createRipple(alertRipple5, 1440),
      ]);
      
      scalePulse.start();
      rippleAnimation.start();
      
      return () => {
        scalePulse.stop();
        rippleAnimation.stop();
        alertPulseAnim.setValue(1);
        alertRipple1.setValue(0);
        alertRipple2.setValue(0);
        alertRipple3.setValue(0);
        alertRipple4.setValue(0);
        alertRipple5.setValue(0);
      };
    }
  }, [device?.state]);

  // Fetch device status and motion events
  const fetchData = useCallback(async () => {
    const statusResult = await getDeviceStatus();
    if (statusResult.data?.device) {
      const newDevice = statusResult.data.device;
      
      // Reset confirmation state when returning from theft detected
      if (device?.state === 'THEFT_DETECTED' && newDevice.state === 'WATCH') {
        setConfirmedNotMe(false);
      }
      
      setDevice(newDevice);
      
      if (newDevice.state !== 'IDLE') {
        const eventsResult = await getMotionEvents();
        if (eventsResult.data?.events) {
          setEvents(eventsResult.data.events);
        }
      } else {
        setEvents([]);
        setConfirmedNotMe(false);
      }
    } else {
      setDevice(null);
    }
  }, [device?.state]);

  useFocusEffect(
    useCallback(() => {
      fetchData().finally(() => setIsLoading(false));
    }, [fetchData])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (device?.state === 'WATCH' || device?.state === 'THEFT_DETECTED') {
        fetchData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [device?.state, fetchData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Toggle device between IDLE and WATCH states
  const handleToggleWatch = async () => {
    if (!device) return;

    setIsUpdating(true);
    const newState: 'IDLE' | 'WATCH' = device.state === 'IDLE' ? 'WATCH' : 'IDLE';
    const result = await setDeviceState(newState);
    
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.data?.device) {
      setDevice(result.data.device);
      if (newState === 'IDLE') {
        setEvents([]);
        setConfirmedNotMe(false);
      }
    }
    setIsUpdating(false);
  };

  // User confirms motion was them - return to IDLE
  const handleConfirmMe = async () => {
    setIsUpdating(true);
    const result = await setDeviceState('IDLE');
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.data?.device) {
      setDevice(result.data.device);
      setEvents([]);
      setConfirmedNotMe(false);
    }
    setIsUpdating(false);
  };

  const handleConfirmNotMe = () => {
    setConfirmedNotMe(true);
  };

  // Toggle alarm on/off
  const handleToggleAlarm = async (value: boolean) => {
    setIsUpdating(true);
    const result = await setAlarm(value);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.data?.device) {
      setDevice(result.data.device);
    }
    setIsUpdating(false);
  };

  // Get color for status indicator based on device state
  const getStateColor = (state: DeviceState): string => {
    switch (state) {
      case 'IDLE': return '#9CA3AF';
      case 'WATCH': return '#27afd8';
      case 'THEFT_DETECTED': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  // Get display label for device state
  const getStateLabel = (state: DeviceState): string => {
    switch (state) {
      case 'IDLE': return 'Idle';
      case 'WATCH': return 'Watching';
      case 'THEFT_DETECTED': return 'Motion detected';
      default: return 'Unknown';
    }
  };

  // Format timestamp to readable time string
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const themedStyles = {
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, themedStyles.container]}>
        <Text style={[styles.loadingText, themedStyles.textSecondary]}>Loading...</Text>
      </View>
    );
  }

  // No device paired state
  if (!device) {
    return (
      <View style={[styles.centerContainer, themedStyles.container]}>
        <Image 
          source={isDark ? require('@/assets/slug_bike_main_dark.png') : require('@/assets/slug_bike.png')} 
          style={styles.noDeviceLogo}
          resizeMode="contain"
        />
        <Text style={[styles.noDeviceTitle, themedStyles.text]}>No Device Paired</Text>
        <Text style={[styles.noDeviceText, themedStyles.textSecondary]}>
          Go to Profile to scan a QR code and pair your Trackstar device.
        </Text>
        <TouchableOpacity
          style={[styles.pairButton, { backgroundColor: colors.primary }]}
          onPress={() => router.navigate('/(main)/profile' as Href)}
        >
          <Text style={styles.pairButtonText}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, themedStyles.container]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >

      {/* Status card - different layout for theft detected */}
      {device.state !== 'THEFT_DETECTED' ? (
        <View style={[styles.statusCard, themedStyles.card]}>
          <Animated.View 
            style={[
              styles.statusIndicator, 
              { backgroundColor: getStateColor(device.state), opacity: pulseAnim }
            ]} 
          />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, themedStyles.text]}>{getStateLabel(device.state)}</Text>
            <Text style={[styles.deviceId, themedStyles.textSecondary]}>Device: {device.id}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.statusCard, styles.theftStatusCard, themedStyles.card]}>
          <TouchableOpacity
            style={styles.dismissXButton}
            onPress={handleConfirmMe}
            disabled={isUpdating}
          >
            <Ionicons name="close-circle" size={28} color={colors.danger} />
          </TouchableOpacity>
          <View style={styles.theftCenterContent}>
            <Animated.View 
              style={[
                styles.statusIndicator, 
                { backgroundColor: getStateColor(device.state), opacity: pulseAnim }
              ]} 
            />
            <View>
              <Text style={[styles.statusLabel, themedStyles.text]}>{getStateLabel(device.state)}</Text>
              <Text style={[styles.deviceId, themedStyles.textSecondary]}>Device: {device.id}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.logMenuButtonInline}
            onPress={() => setShowLogModal(true)}
          >
            <Ionicons name="menu-outline" size={24} color={colors.icon} />
          </TouchableOpacity>
        </View>
      )}

      {device.state !== 'THEFT_DETECTED' && (
        <View style={styles.mainButtonContainer}>
          <View style={styles.buttonWrapper}>
            {device.state === 'WATCH' && [ripple1, ripple2, ripple3, ripple4, ripple5].map((ripple, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.ripple,
                  {
                    backgroundColor: '#27afd8',
                    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
                    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
                  },
                ]}
              />
            ))}
            
            <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.mainButton,
                  device.state === 'WATCH' ? styles.stopButton : styles.startButton,
                ]}
                onPress={handleToggleWatch}
                disabled={isUpdating}
              >
                <Ionicons
                  name="navigate"
                  size={96}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
          <Text style={[styles.mainButtonText, themedStyles.text]}>
            {device.state === 'WATCH' ? 'Click to stop watching' : 'Click to start watching'}
          </Text>
        </View>
      )}

      {/* Theft detected UI - large animated circle and controls */}
      {device.state === 'THEFT_DETECTED' && (
        <View style={styles.theftDetectedContainer}>
          <View style={styles.alertCircleContainer}>
            <View style={styles.alertButtonWrapper}>
              {[alertRipple1, alertRipple2, alertRipple3, alertRipple4, alertRipple5].map((ripple, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.alertRipple,
                    {
                      transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
                      opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
                    },
                  ]}
                />
              ))}
              <Animated.View style={[styles.alertCircle, { transform: [{ scale: alertPulseAnim }] }]}>
                <Ionicons name="warning" size={96} color="#fff" />
              </Animated.View>
            </View>
            <Text style={[styles.alertCircleText, themedStyles.text]}>Motion detected</Text>
          </View>

          {/* Bottom container - confirmation or alarm controls */}
          <View style={[styles.alertContainer, themedStyles.card]}>
            {!confirmedNotMe ? (
              <View style={styles.confirmSection}>
                <Text style={[styles.confirmQuestion, themedStyles.text]}>Was this movement caused by you?</Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.yesButton]}
                    onPress={handleConfirmMe}
                    disabled={isUpdating}
                  >
                    <Text style={styles.yesButtonText}>Yes, it was me</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.noButton]}
                    onPress={handleConfirmNotMe}
                    disabled={isUpdating}
                  >
                    <Text style={styles.noButtonText}>No, not me</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.alarmSection}>
                {/* Alarm toggle button */}
                <TouchableOpacity
                  style={[
                    styles.alarmButton,
                    device.alarmActive && styles.alarmButtonActive
                  ]}
                  onPress={() => handleToggleAlarm(!device.alarmActive)}
                  disabled={isUpdating}
                >
                  <Ionicons 
                    name="volume-high" 
                    size={32} 
                    color={device.alarmActive ? '#fff' : '#9CA3AF'} 
                  />
                </TouchableOpacity>
                {/* Track bike button (GPS feature - placeholder) */}
                <TouchableOpacity
                  style={styles.trackBikeButton}
                  onPress={() => {}}
                  disabled={isUpdating}
                >
                  <Text style={styles.trackBikeText}>Track bike</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/*Detection log modal */}
      <Modal
        visible={showLogModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={[styles.modalContainer, themedStyles.container]}>
          <View style={[styles.modalHeader, themedStyles.card]}>
            <Text style={[styles.modalTitle, themedStyles.text]}>Detection Log</Text>
            <TouchableOpacity onPress={() => setShowLogModal(false)}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {/* List of motion detection events */}
            {events.length > 0 ? (
              events.map((event) => (
                <View key={event.id} style={[styles.eventItem, themedStyles.card, { marginBottom: 8 }]}>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                  <Text style={[styles.eventText, themedStyles.text]}>Motion detected</Text>
                  <Text style={[styles.eventTime, themedStyles.textSecondary]}>{formatTime(event.timestamp)}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noEventsText, themedStyles.textSecondary]}>No detection events yet</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  noDeviceLogo: {
    width: 120,
    height: 120,
    opacity: 0.85,
  },
  noDeviceTitle: {
    fontSize: 20,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
    marginTop: 16,
  },
  noDeviceText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  pairButton: {
    marginTop: 24,
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  pairButtonText: {
    color: '#fff',
    fontFamily: 'Oxygen_700Bold',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  theftActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
    marginHorizontal: -8,
  },
  dismissXButton: {
    padding: 4,
  },
  logMenuButtonInline: {
    padding: 4,
  },
  theftStatusCard: {
    justifyContent: 'space-between',
  },
  theftCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  theftActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },  motionDetectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  motionDetectedCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  motionDetectedText: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#EF4444',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
  },
  deviceId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  mainButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  mainButton: {
    width: 260,
    height: 260,
    borderRadius: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#6B7280',
  },
  stopButton: {
    backgroundColor: '#27afd8',
  },
  mainButtonText: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    marginTop: 28,
  },
  theftDetectedContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  alertCircleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonWrapper: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertRipple: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#EF4444',
  },
  alertCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCircleText: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    marginTop: 28,
  },
  alertContainer: {
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertTitle: {
    fontSize: 20,
    fontFamily: 'Oxygen_700Bold',
    color: '#991B1B',
  },
  confirmSection: {
    marginTop: 20,
  },
  confirmQuestion: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#10B981',
  },
  yesButtonText: {
    color: '#fff',
    fontFamily: 'Oxygen_700Bold',
  },
  noButton: {
    backgroundColor: '#EF4444',
  },
  noButtonText: {
    color: '#fff',
    fontFamily: 'Oxygen_700Bold',
  },
  alarmSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 50,
    paddingVertical: 12,
  },
  alarmButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmButtonActive: {
    backgroundColor: '#EF4444',
  },
  trackBikeButton: {
    height: 64,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#27afd8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBikeText: {
    fontSize: 18,
    fontFamily: 'Oxygen_700Bold',
    color: '#fff',
  },  alarmLabel: {
    fontSize: 14,
    fontFamily: 'Oxygen_700Bold',
    color: '#991B1B',
    marginBottom: 8,
  },
  alarmToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
  },
  alarmStatus: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
  },
  dismissButton: {
    marginTop: 16,
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontFamily: 'Oxygen_700Bold',
  },
  eventsSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventsSectionTitle: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  eventText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  eventTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Oxygen_700Bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  noEventsText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
  },
});

