import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Scrape a URL and return clean body text (strips nav, footer, ads, scripts).
 */
export async function scrapeUrl(url) {
    const { data } = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LearnFlowBot/1.0)" },
        timeout: 15000,
    });

    const $ = cheerio.load(data);

    // Remove clutter
    $("script, style, nav, footer, header, aside, .ad, .advertisement, [role='navigation'], [role='banner']").remove();

    // Prefer main content areas
    const selectors = ["main", "article", ".content", ".post-content", "#content", "body"];
    let text = "";
    for (const sel of selectors) {
        const el = $(sel);
        if (el.length && el.text().trim().length > 200) {
            text = el.text();
            break;
        }
    }

    // Normalise whitespace
    return text.replace(/\s+/g, " ").trim();
}
