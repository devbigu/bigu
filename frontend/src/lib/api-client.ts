import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const DEFAULT_API_URL = "http://localhost:4000/api";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
const AUTH_REFRESH_PATH = "/auth/refresh";
const authSkipPaths = ["/auth/login", "/auth/register", AUTH_REFRESH_PATH];

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshPromise: Promise<unknown> | null = null;

function shouldSkipRefresh(url?: string) {
  if (!url) {
    return false;
  }

  return authSkipPaths.some((path) => url.includes(path));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipRefresh(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= apiClient.post(AUTH_REFRESH_PATH);
      await refreshPromise;
      refreshPromise = null;
      return apiClient(originalRequest);
    } catch (refreshError) {
      refreshPromise = null;

      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }

      return Promise.reject(refreshError);
    }
  }
);