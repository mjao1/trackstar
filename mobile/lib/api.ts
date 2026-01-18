import * as SecureStore from 'expo-secure-store';

// Change this to your Railway URL after deployment
// Use your computer's IP address so the phone can reach the backend
//const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.9:3000'; // suhyeon
//const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.4:3000'; // emma
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.0.31:3000'; // home

const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { error: json.error || 'Request failed' };
    }

    return { data: json };
  } catch (error) {
    console.error('API request error:', error);
    return { error: 'Network error' };
  }
}

// Auth API
export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export async function signup(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
  const result = await request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  if (result.data?.token) {
    await setToken(result.data.token);
  }
  
  return result;
}

export async function login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
  const result = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  if (result.data?.token) {
    await setToken(result.data.token);
  }
  
  return result;
}

export async function googleAuth(googleId: string, email: string): Promise<ApiResponse<AuthResponse>> {
  const result = await request<AuthResponse>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ googleId, email }),
  });
  
  if (result.data?.token) {
    await setToken(result.data.token);
  }
  
  return result;
}

export async function savePushToken(pushToken: string): Promise<ApiResponse<{ success: boolean }>> {
  return request('/api/auth/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}

export async function getMe(): Promise<ApiResponse<{ user: { id: string; email: string } }>> {
  return request('/api/auth/me');
}

// Device API
export type DeviceState = 'IDLE' | 'WATCH' | 'THEFT_DETECTED';

export interface Device {
  id: string;
  state: DeviceState;
  alarmActive: boolean;
  lastMotionAt?: string;
}

export interface MotionEvent {
  id: string;
  deviceId: string;
  timestamp: string;
}

export async function claimDevice(deviceId: string, secret: string): Promise<ApiResponse<{ device: Device }>> {
  return request('/api/device/claim', {
    method: 'POST',
    body: JSON.stringify({ deviceId, secret }),
  });
}

export async function unclaimDevice(): Promise<ApiResponse<{ success: boolean }>> {
  return request('/api/device/unclaim', {
    method: 'DELETE',
  });
}

export async function getDeviceStatus(): Promise<ApiResponse<{ device: Device | null }>> {
  return request('/api/device/status');
}

export async function setDeviceState(state: 'IDLE' | 'WATCH'): Promise<ApiResponse<{ device: Device }>> {
  return request('/api/device/state', {
    method: 'POST',
    body: JSON.stringify({ state }),
  });
}

export async function setAlarm(active: boolean): Promise<ApiResponse<{ device: Device }>> {
  return request('/api/device/alarm', {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export async function getMotionEvents(): Promise<ApiResponse<{ events: MotionEvent[] }>> {
  return request('/api/device/events');
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  lastGpsUpdate: string;
}

export async function getGpsLocation(): Promise<ApiResponse<GpsLocation>> {
  return request('/api/device/gps');
}
