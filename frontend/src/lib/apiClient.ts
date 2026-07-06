import axios, { AxiosError } from "axios";
import { getToken, removeToken } from "@/lib/auth";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 10000,
  headers: {
    Accept: "application/json; charset=utf-8",
    "Content-Type": "application/json; charset=utf-8",
  },
  responseType: "json",
  responseEncoding: "utf8",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    if (status === 401 && getToken() && !err.config?.url?.includes("/auth/login")) {
      removeToken();
      window.location.href = "/login";
    }
    if (!err.response) {
      return Promise.reject(new ApiError("无法连接后端服务，请确认 API 已在 8000 端口启动"));
    }
    const message =
      detail ||
      (status === 500 && err.config?.url?.includes("/auth/")
        ? "后端服务异常或未启动，请稍后重试"
        : status === 404
          ? "资源不存在"
          : err.message || "请求失败，请稍后重试");
    return Promise.reject(new ApiError(message, status));
  },
);

export default api;
