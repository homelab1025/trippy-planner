import axios from 'axios'
import { AuthApi, RoutesApi, ShareApi, VersionApi } from './api'
import { getToken, clearToken } from './auth'
import { reportError } from './services/errorBus'
import { notifySessionExpired } from './services/sessionEvents'

export const axiosInstance = axios.create()

axiosInstance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    if (status === undefined) {
      reportError('Network error — please check your connection and try again.')
    } else if (status === 401) {
      clearToken()
      notifySessionExpired()
      reportError('Your session has expired. Please sign in again.')
    } else if (status >= 500) {
      reportError('Something went wrong on our end. Please try again.')
    }
    return Promise.reject(error)
  }
)

export const authApi = new AuthApi(undefined, undefined, axiosInstance)
export const routesApi = new RoutesApi(undefined, undefined, axiosInstance)
export const shareApi = new ShareApi(undefined, undefined, axiosInstance)

// versionApi is a purely cosmetic background probe (App.tsx's Tech Details panel) that's
// always designed to fail silently — it must not go through the response interceptor, or a
// merely-unreachable backend surfaces an unsolicited "Network error" banner on every page load.
export const silentAxiosInstance = axios.create()

export const versionApi = new VersionApi(undefined, undefined, silentAxiosInstance)
