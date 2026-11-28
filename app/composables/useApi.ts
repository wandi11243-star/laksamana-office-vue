import type { FetchError } from 'ofetch'

/** The v1 envelope. Every laksamana-api response is `{data, meta?}` or `{error}`. */
export interface Envelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  error: { code: string, message: string, details?: unknown }
}

/**
 * Bearer token from POST /auth/login. Lives 30 days (sanctum.token_days).
 *
 * The cookie is only the persistence layer: Nuxt flushes the `document.cookie`
 * write on the next tick, so reading the cookie straight after `login()` (which
 * `fetchMe()` does) would still come back empty and the request would go out
 * unauthenticated. `useState` is the value callers see immediately; the cookie
 * keeps it across reloads.
 */
export const useToken = () => {
  const cookie = useCookie<string | null>('lm_token', { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: !import.meta.dev })
  const token = useState<string | null>('lm_token', () => cookie.value ?? null)

  return computed<string | null>({
    get: () => token.value ?? cookie.value ?? null,
    set: (value) => {
      token.value = value
      cookie.value = value
    },
  })
}

/**
 * The one way to call laksamana-api. Adds the Bearer token; a 401 clears it and
 * goes to /login. Returns the raw envelope, so callers read `.data` (and `.meta`).
 *
 *   const api = useApi()
 *   const { data } = await api<Envelope<Me>>('/me')
 */
export function useApi() {
  const token = useToken()
  const { apiBase } = useRuntimeConfig().public

  const route = useRouter().currentRoute
  const aktivitas = useState('konten-api-pending', () => ({ baca: 0, tulis: 0 }))
  const api = $fetch.create({
    baseURL: apiBase,
    headers: { Accept: 'application/json' },
    onRequest({ options }) {
      if (token.value) options.headers.set('Authorization', `Bearer ${token.value}`)
    },
    onResponseError({ response }) {
      if (response.status === 401 && token.value) {
        token.value = null
        useMe().value = null
        navigateTo('/login')
      }
    },
  })

  return new Proxy(api, {
    apply(target, receiver, args: [string | Request, { method?: string }?]) {
      const [request, options] = args
      const path = typeof request === 'string' ? request : request.url
      if (!path.startsWith('/konten/') && !/^\/konten(?:\/|$)/.test(route.value.path)) {
        return Reflect.apply(target, receiver, args)
      }
      const method = (options?.method ?? (typeof request === 'string' ? 'GET' : request.method)).toUpperCase()
      const jenis = method === 'GET' || method === 'HEAD' ? 'baca' : 'tulis'
      aktivitas.value[jenis]++
      return Promise.resolve().then(() => Reflect.apply(target, receiver, args)).finally(() => {
        aktivitas.value[jenis]--
      })
    },
  })
}

/** The API's own message (`error.message`), or a plain fallback. Show this to users. */
export function apiErrorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const body = (e as FetchError<ApiErrorBody>)?.data
  if (body?.error?.message) return body.error.message
  if ((e as FetchError)?.statusCode === undefined) return 'Tidak bisa terhubung ke server. Periksa koneksi.'
  return fallback
}

/** The API's error code (`error.code`), for branching on a specific refusal. */
export const apiErrorCode = (e: unknown): string | undefined =>
  (e as FetchError<ApiErrorBody>)?.data?.error?.code
