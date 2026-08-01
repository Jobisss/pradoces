// Vitest stub for the `server-only` package. Next's webpack build aliases
// `server-only` to a no-op for server bundles and to a throwing module for
// client bundles; vitest has no such bundler-side distinction, so every test
// runs in a "server" context here and the import should be a no-op.
export {}
