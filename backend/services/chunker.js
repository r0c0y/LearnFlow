/**
 * Split raw text into semantic chunks of ~800 words with 80-word overlap.
 * Returns array of { id, text, index }.
 */
export function chunkText(text, chunkSize = 800, overlap = 80) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let i = 0;
    let idx = 0;

    while (i < words.length) {
        const slice = words.slice(i, i + chunkSize);
        chunks.push({
            id: `chunk_${String(idx).padStart(3, "0")}`,
            text: slice.join(" "),
            index: idx,
        });
        i += chunkSize - overlap;
        idx++;
    }

    return chunks;
}
