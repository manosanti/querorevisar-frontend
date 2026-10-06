import { defineConfig } from 'orval';

// Input: openapi.yaml (contract-first). `pnpm api:gen` refreshes it from the live API (/v3/api-docs).
export default defineConfig({
  api: {
    input: { target: './openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints',
      schemas: './src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/http.ts', name: 'customFetch' },
        query: { useQuery: true, useMutation: true, signal: true },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  apiZod: {
    input: { target: './openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: './src/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
    },
  },
});
