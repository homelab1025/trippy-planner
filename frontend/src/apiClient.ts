import axios from 'axios'
import { AuthApi, RoutesApi, ShareApi, VersionApi } from './api'
import { getToken } from './auth'

export const axiosInstance = axios.create()

axiosInstance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = new AuthApi(undefined, undefined, axiosInstance)
export const routesApi = new RoutesApi(undefined, undefined, axiosInstance)
export const shareApi = new ShareApi(undefined, undefined, axiosInstance)
export const versionApi = new VersionApi(undefined, undefined, axiosInstance)
