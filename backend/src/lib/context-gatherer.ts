export interface ContextSource {
  name: string;
  gather: () => Promise<string>;
}

export async function gatherAllContext(
  sources: ContextSource[],
): Promise<{ name: string; content: string }[]> {
  const results = await Promise.allSettled(
    sources.map((s) => s.gather()),
  );

  const output: { name: string; content: string }[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      output.push({ name: sources[i].name, content: r.value });
    } else if (r.status === "rejected") {
      console.warn(`[context-gatherer] Source "${sources[i].name}" failed:`, r.reason);
    }
  }
  return output;
}
