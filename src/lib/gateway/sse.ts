/** Reads a Server-Sent Events body and yields the `data:` payload of each event. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dataOf = (block: string) =>
    block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      for (let i = buffer.indexOf("\n\n"); i !== -1; i = buffer.indexOf("\n\n")) {
        const data = dataOf(buffer.slice(0, i));
        buffer = buffer.slice(i + 2);
        if (data) yield data;
      }
    }
    const rest = dataOf(buffer);
    if (rest) yield rest;
  } finally {
    await reader.cancel().catch(() => {}); // closes the connection if the consumer stops early
  }
}
