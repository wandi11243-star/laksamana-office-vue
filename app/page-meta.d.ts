declare module '#app' {
  interface PageMeta {
    /** Reachable without logging in (login page). */
    public?: boolean
    /** Access keys from GET /me `modules`; any one of them opens the page. */
    access?: string[]
  }
}

export {}
