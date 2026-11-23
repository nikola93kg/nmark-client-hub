const batchSize = 250;

export async function readAll<T>(
  read: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { code: string } | null }>,
  message: string,
) {
  const rows: T[] = [];
  for (let start = 0; ; start += batchSize) {
    const { data, error } = await read(start, start + batchSize - 1);
    if (error?.code === "PGRST103" && start > 0) return rows;
    if (error || !data) throw new Error(message);
    rows.push(...data);
    if (data.length < batchSize) return rows;
  }
}
