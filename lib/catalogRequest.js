export async function runCatalogQuery(query, timeoutMs = 20000) {
  const controller = new AbortController();
  let timer;
  try {
    // A separate deadline also covers a client waiting for an auth lock before fetch.
    return await Promise.race([
      query.abortSignal(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("La conexión está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo."));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
