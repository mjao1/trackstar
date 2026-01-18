import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { getDeviceStatus, unclaimDevice, Device } from '@/lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [device, setDevice] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch current device pairing status
  const fetchDevice = useCallback(async () => {
    const result = await getDeviceStatus();
    if (result.data?.device) {
      setDevice(result.data.device);
    } else {
      setDevice(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDevice().finally(() => setIsLoading(false));
    }, [fetchDevice])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchDevice();
    setIsRefreshing(false);
  };

  // Navigate to QR code scanner
  const handleScanQR = () => {
    router.push('/scan');
  };

  // Unpair device with confirmation
  const handleUnpair = () => {
    Alert.alert(
      'Unpair Device',
      'Are you sure you want to unpair this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            const result = await unclaimDevice();
            if (result.error) {
              Alert.alert('Error', result.error);
            } else {
              setDevice(null);
            }
          },
        },
      ]
    );
  };

  // Logout user with confirmation
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const themedStyles = {
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    border: { borderColor: colors.border },
  };

  return (
    <ScrollView
      style={[styles.container, themedStyles.container]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Device section */}
      <View style={styles.sectionFirst}>
        <Text style={[styles.sectionTitle, themedStyles.textSecondary]}>Device</Text>
        
        {isLoading ? (
          <View style={[styles.card, themedStyles.card]}>
            <Text style={[styles.loadingText, themedStyles.textSecondary]}>Loading...</Text>
          </View>
        ) : device ? (
          <View style={[styles.card, themedStyles.card]}>
            <View style={styles.deviceRow}>
              <View style={styles.deviceInfo}>
                <View style={[styles.deviceIconContainer, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="hardware-chip" size={24} color={colors.icon} />
                </View>
                <View>
                  <Text style={[styles.deviceId, themedStyles.text]}>{device.id}</Text>
                  <Text style={[styles.deviceStatus, themedStyles.textSecondary]}>
                    Status: {device.state}
                  </Text>
                </View>
              </View>
              <View style={[styles.pairedBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.pairedBadgeText, { color: colors.icon }]}>Paired</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.unpairButton, { borderTopColor: colors.border }]}
              onPress={handleUnpair}
            >
              <Ionicons name="unlink" size={18} color={colors.danger} />
              <Text style={[styles.unpairButtonText, { color: colors.danger }]}>Unpair Device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, themedStyles.card]}>
            <View style={styles.noDeviceContainer}>
              <Ionicons name="qr-code-outline" size={48} color={colors.iconMuted} />
              <Text style={[styles.noDeviceText, themedStyles.text]}>No device paired</Text>
              <Text style={[styles.noDeviceSubtext, themedStyles.textSecondary]}>
                Scan the QR code on your Trackstar device to pair it
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.primary }]}
              onPress={handleScanQR}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.scanButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Appearance section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, themedStyles.textSecondary]}>Appearance</Text>
        <View style={[styles.card, themedStyles.card]}>
          <View style={styles.themeRow}>
            <View style={styles.themeInfo}>
              <Ionicons 
                name={isDark ? 'moon' : 'sunny'} 
                size={22} 
                color={colors.icon} 
              />
              <Text style={[styles.themeLabel, themedStyles.text]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isDark ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* Account section*/}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, themedStyles.textSecondary]}>Account</Text>
        <View style={[styles.card, themedStyles.card]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={[styles.menuItemTextDanger, { color: colors.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionFirst: {
    marginTop: 0,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Oxygen_700Bold',
    color: '#6B7280',
    marginBottom: 12,
    paddingLeft: 4,
  },
  loadingText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceId: {
    fontSize: 14,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pairedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pairedBadgeText: {
    fontSize: 12,
    fontFamily: 'Oxygen_700Bold',
    color: '#10B981',
  },
  unpairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingTop: 20,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  unpairButtonText: {
    fontSize: 14,
    fontFamily: 'Oxygen_700Bold',
    color: '#EF4444',
  },
  noDeviceContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  noDeviceText: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#111827',
    marginTop: 12,
  },
  noDeviceSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  scanButtonText: {
    fontSize: 16,
    fontFamily: 'Oxygen_700Bold',
    color: '#fff',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  menuItemTextDanger: {
    fontSize: 16,
    color: '#EF4444',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeLabel: {
    fontSize: 16,
  },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 32,
  },
});

