# CLAUDE.md — Frontend Template (React 19 + Vite + Tailwind)

> Extiende: `00-SHARED-PRINCIPLES-CLAUDE.md` (sección Frontend)
> Aplica a: P2 (DevOps Dashboard), P3 (Blog CMS), P4 (Chat)

## Base Stack

- **React 19** con TypeScript 5.x strict
- **Vite 6.x** (build + dev server)
- **Tailwind CSS v4**
- **Zustand** — solo client state (auth, theme, UI)
- **TanStack React Query v5** — todo server state
- **Axios** — HTTP client con JWT interceptor
- **React Router v7**

## Architecture

```
src/
├── api/
│   ├── client.ts               # Axios instance + interceptors (ver abajo)
│   └── {domain}.ts             # Funciones tipadas: getProducts(), createPost(), etc.
│
├── components/
│   ├── ui/                     # Primitivos: Button, Input, Modal, Badge, Skeleton
│   ├── layout/                 # Layout, Sidebar, Navbar, ErrorBoundary
│   └── {domain}/               # ProductCard, PostEditor, ChatBubble, etc.
│
├── hooks/
│   ├── queries/                # useProducts(), usePosts() — wrappers React Query
│   │   └── use-{domain}.ts    # Cada hook = 1 query/mutation tipada
│   ├── useDebounce.ts
│   └── usePermissions.ts
│
├── pages/                      # Route components — orquestan hooks + components
│   └── {Page}.tsx
│
├── store/
│   ├── auth.store.ts           # Zustand: user, accessToken, refreshToken, role
│   └── theme.store.ts          # Zustand: darkMode toggle
│
├── types/
│   └── index.ts                # Shared types (sync con backend)
│
├── lib/
│   └── utils.ts                # Helpers puros (formatDate, cn(), etc.)
│
└── main.tsx
```

## Principios obligatorios

1. **Server state en React Query, client state en Zustand** — nunca al revés
   ```tsx
   // ❌ MAL: guardar data del server en Zustand
   const { products, setProducts } = useProductStore()
   
   // ✅ BIEN: React Query cachea automáticamente
   const { data: products, isLoading } = useProducts()
   ```

2. **Custom hooks para queries** — 1 hook = 1 query tipada
   ```tsx
   // hooks/queries/use-products.ts
   export function useProducts(filter?: ProductFilter) {
     return useQuery({
       queryKey: ['products', filter],
       queryFn: () => productApi.list(filter),
     })
   }
   ```

3. **No `any`** — `unknown` + type guard si es necesario. No `as` excepto en boundary con libs.

4. **Componentes < 150 líneas** — si crece, extraer sub-componentes o hooks.

5. **Error boundaries por page** — cada page envuelta en ErrorBoundary.

6. **Loading states con Skeleton** — no spinners genéricos.

7. **Colocation**: hook + component que lo usa en el mismo directorio si son 1:1.

## Axios interceptor (pattern correcto)

```typescript
// api/client.ts
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth.store'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request: inject Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response: auto-refresh on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token!)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { refreshToken } = useAuthStore.getState()
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
      processQueue(null, data.access_token)
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().logout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export { api }
```

> Este interceptor maneja correctamente el caso de múltiples requests simultáneas que fallan con 401:
> las encola mientras el refresh está en curso, y las resuelve todas cuando el nuevo token llega.
> El patrón simplista del inventory-front original NO maneja este caso.

## Diferencias por proyecto

### P2 — DevOps Dashboard
- **Extra**: Recharts (gráficas), SSE hook
- **Dominio**: `ops.jcrlabs.net`
- **Hook SSE**:
  ```tsx
  function useSSE(url: string, onMessage: (data: unknown) => void) {
    useEffect(() => {
      const source = new EventSource(url)
      source.onmessage = (e) => onMessage(JSON.parse(e.data))
      source.onerror = () => { source.close(); /* retry logic */ }
      return () => source.close()
    }, [url])
  }
  ```

### P3 — Blog CMS
- **Extra**: TipTap editor, Apollo Client (reemplaza React Query para GraphQL)
- **Dominio**: `blog.jcrlabs.net`
- **Data fetching**: Apollo `useQuery`/`useMutation` en vez de React Query. Zustand sigue para auth.

### P4 — Chat
- **Extra**: WebSocket hook con reconnect, `@tanstack/react-virtual` para message list
- **Dominio**: `chat.jcrlabs.net`
- **Hook WebSocket**:
  ```tsx
  function useWebSocket(url: string) {
    const [ws, setWs] = useState<WebSocket | null>(null)
    const reconnectDelay = useRef(1000)
    
    const connect = useCallback(() => {
      const socket = new WebSocket(url)
      socket.onopen = () => { reconnectDelay.current = 1000 }
      socket.onclose = () => {
        setTimeout(connect, reconnectDelay.current)
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
      }
      setWs(socket)
    }, [url])
    
    useEffect(() => { connect(); return () => ws?.close() }, [])
    
    const send = useCallback((msg: object) => {
      ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg))
    }, [ws])
    
    return { ws, send }
  }
  ```
