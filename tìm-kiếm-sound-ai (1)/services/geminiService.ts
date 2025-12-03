
import { GoogleGenAI, Type } from "@google/genai";
import { SoundEffect, WebSearchResult, CATEGORIES } from "../types";

// Initialize Gemini Client
// Assumes process.env.API_KEY is available as per instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FLASH = 'gemini-2.5-flash';

/**
 * Auto-tags and categorizes a sound based on its filename and optional audio data.
 */
export const analyzeSoundInfo = async (
  filename: string, 
  base64Audio?: string,
  mimeType?: string
): Promise<{ name: string; category: string; tags: string[] }> => {
  try {
    const prompt = `
      Bạn là một trợ lý phân tích âm thanh cho Editor chuyên nghiệp.
      Hãy phân tích tệp âm thanh này.
      Tên gốc: "${filename}".
      
      Nhiệm vụ:
      1. Đặt lại tên (Title) bằng TIẾNG VIỆT sao cho dễ hiểu, ngắn gọn, mô tả đúng âm thanh (bỏ đuôi file, bỏ ký tự lạ).
      2. Chọn một Danh mục (Category) phù hợp nhất từ danh sách này: ${JSON.stringify(CATEGORIES)}.
      3. Tạo 3-5 thẻ (tags) mô tả ngắn gọn bằng TIẾNG VIỆT (ví dụ: tiếng bước chân, tiếng mưa, cháy nổ).
      
      Trả về định dạng JSON.
    `;

    const parts: any[] = [{ text: prompt }];
    
    // If audio data is provided (short clips), we can send it for multimodal analysis
    if (base64Audio && mimeType) {
      parts.push({
        inlineData: {
          data: base64Audio,
          mimeType: mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Error analyzing sound:", error);
    // Fallback if AI fails
    return {
      name: filename.replace(/\.[^/.]+$/, ""),
      category: "Chưa phân loại",
      tags: ["imported"]
    };
  }
};

/**
 * Checks potential copyright issues based on the sound name and origin description.
 */
export const checkCopyright = async (soundName: string, source: string): Promise<{ status: 'Safe' | 'Risky' | 'Unknown', reason: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: `
        Analyze the copyright risk for a sound effect named "${soundName}" derived from "${source}".
        
        Is this likely a famous copyrighted sound (like a movie quote, specific game sound, famous song clip)?
        
        Return JSON with:
        - status: "Safe" (generic sounds like 'footsteps', 'rain'), "Risky" (likely specific IP), or "Unknown".
        - reason: Short explanation in Vietnamese.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ["Safe", "Risky", "Unknown"] },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { status: "Unknown", reason: "AI could not determine." };
  } catch (e) {
    return { status: "Unknown", reason: "Service unavailable." };
  }
};

/**
 * Uses Gemini Grounding (Google Search) to find sound effects online.
 */
export const findSoundsOnline = async (query: string): Promise<WebSearchResult[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: `Find free or royalty-free sound effects for: "${query}". Return a list of websites or direct download pages.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const results: WebSearchResult[] = [];

    if (chunks) {
        chunks.forEach((chunk: any) => {
            if (chunk.web) {
                results.push({
                    title: chunk.web.title,
                    link: chunk.web.uri,
                    snippet: "Tìm thấy qua Google Search"
                });
            }
        });
    }
    
    return results;
  } catch (error) {
    console.error("Search error", error);
    return [];
  }
};

/**
 * Smart Local Search: Filters the local library based on natural language.
 */
export const smartFilterLibrary = async (query: string, library: SoundEffect[]): Promise<string[]> => {
  try {
    // Create a lightweight index for the AI
    const index = library.map(s => ({ id: s.id, name: s.name, tags: s.tags, category: s.category }));
    
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: `
        You are a smart search engine for sound effects.
        User Query (Vietnamese or English): "${query}"
        
        Library Index:
        ${JSON.stringify(index)}
        
        Return a JSON object containing an array of "ids" that best match the query semantically.
        Example: "âm thanh đáng sợ" -> matches items with tags "kinh dị", "hét", "tối tăm".
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ids: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return data.ids || [];
    }
    return [];
  } catch (error) {
    console.error("Smart filter error", error);
    // Fallback to simple keyword match
    const lowerQ = query.toLowerCase();
    return library
      .filter(s => s.name.toLowerCase().includes(lowerQ) || s.tags.some(t => t.toLowerCase().includes(lowerQ)))
      .map(s => s.id);
  }
};

/**
 * Generates personalized sound recommendations based on usage history.
 */
export const getRecommendations = async (
  searchHistory: string[],
  favorites: SoundEffect[],
  library: SoundEffect[]
): Promise<{ id: string; reason: string }[]> => {
  try {
    // 1. Prepare User Profile
    const favoriteTags = Array.from(new Set(favorites.flatMap(f => f.tags))).slice(0, 20);
    const favoriteCats = Array.from(new Set(favorites.map(f => f.category)));
    const recentSearches = searchHistory.slice(0, 10); // Last 10 searches

    if (library.length === 0) return [];

    // 2. Prepare Library Index (lightweight)
    const libraryIndex = library.map(s => ({ 
      id: s.id, 
      name: s.name, 
      tags: s.tags.slice(0, 5), 
      category: s.category 
    }));

    // 3. Prompt Gemini
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: `
        Act as an intelligent sound design assistant for a Vietnamese editor.
        
        User Context:
        - Recent Searches: ${JSON.stringify(recentSearches)}
        - Preferred Categories: ${JSON.stringify(favoriteCats)}
        - Preferred Tags: ${JSON.stringify(favoriteTags)}

        Available Library:
        ${JSON.stringify(libraryIndex)}

        Task: 
        Recommend up to 6 sound effects from the Available Library that this user might find useful right now.
        
        Return JSON:
        {
          "recommendations": [
            { "id": "sound_id", "reason": "Short explanation in Vietnamese (e.g. 'Phù hợp với tìm kiếm khoa học viễn tưởng của bạn')" }
          ]
        }
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  reason: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return data.recommendations || [];
    }
    return [];

  } catch (error) {
    console.error("Recommendation error", error);
    return [];
  }
};