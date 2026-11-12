/** The backend setting that holds each provider's API key (see backend/.env.example). */
const ENV_KEYS: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

export const envKeyFor = (provider: string) => ENV_KEYS[provider] ?? `${provider.toUpperCase()}_API_KEY`
