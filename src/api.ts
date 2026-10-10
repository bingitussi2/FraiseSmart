import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";
const TOKEN_KEY = "kivusense.session";

export type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
};
export type Greenhouse = {
  id: number;
  name: string;
  crop: string;
  variety?: string | null;
  location?: string | null;
  photo_url?: string | null;
  automatic_mode: boolean;
  device_key?: string;
};
export type Measurement = {
  id: number;
  greenhouse_id: number;
  air_temperature: number;
  air_humidity: number;
  soil_moisture: number;
  luminosity: number;
  co2?: number | null;
  pressure?: number | null;
  water_level?: number | null;
  recorded_at: string;
};
export type ApiAlert = {
  id: number;
  greenhouse_id: number;
  level: string;
  title: string;
  message: string;
  resolved: boolean;
  created_at: string;
};
export type Actuators = {
  greenhouse_id: number;
  pump: boolean;
  fan: boolean;
  mister: boolean;
  grow_light: boolean;
  buzzer: boolean;
  updated_at: string;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const token = authenticated ? await AsyncStorage.getItem(TOKEN_KEY) : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item: any) => item.msg || item.message).join(" · ")
      : data.detail;
    throw new Error(detail || `Erreur API (${response.status})`);
  }
  return data as T;
}

export const session = {
  token: () => AsyncStorage.getItem(TOKEN_KEY),
  save: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    ),
  register: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
  }) =>
    request<{ access_token: string; user: User }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
      false,
    ),
  me: () => request<User>("/auth/me"),
  updateProfile: (payload: {
    full_name: string;
    email: string;
    phone?: string | null;
  }) =>
    request<User>("/auth/me", { method: "PUT", body: JSON.stringify(payload) }),
  changePassword: (current_password: string, new_password: string) =>
    request("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),
  greenhouses: () => request<Greenhouse[]>("/greenhouses"),
  createGreenhouse: (payload: {
    name: string;
    location?: string;
    variety?: string;
    photo_url?: string;
  }) =>
    request<Greenhouse>("/greenhouses", {
      method: "POST",
      body: JSON.stringify({ crop: "Fraise", ...payload }),
    }),
  provisioning: (id: number) =>
    request<Greenhouse & { device_key: string }>(
      `/greenhouses/${id}/provisioning`,
    ),
  updateMode: (id: number, automatic_mode: boolean) =>
    request<Greenhouse>(`/greenhouses/${id}/mode`, {
      method: "PATCH",
      body: JSON.stringify({ automatic_mode }),
    }),
  latest: (id: number) =>
    request<Measurement>(`/greenhouses/${id}/measurements/latest`),
  history: (id: number, limit = 100) =>
    request<Measurement[]>(`/greenhouses/${id}/measurements?limit=${limit}`),
  alerts: (id: number) => request<ApiAlert[]>(`/greenhouses/${id}/alerts`),
  resolveAlert: (greenhouseId: number, alertId: number) =>
    request<ApiAlert>(
      `/greenhouses/${greenhouseId}/alerts/${alertId}/resolve`,
      { method: "PATCH" },
    ),
  actuators: (id: number) => request<Actuators>(`/greenhouses/${id}/actuators`),
  updateActuators: (
    id: number,
    payload: Omit<Actuators, "greenhouse_id" | "updated_at">,
  ) =>
    request<Actuators>(`/greenhouses/${id}/actuators`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  thresholds: (id: number, payload: Record<string, number>) =>
    request(`/greenhouses/${id}/thresholds`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
