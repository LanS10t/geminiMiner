import { GoogleGenAI } from "@google/genai";
import { MineralItem, BlockType, QualityTier } from '../types';

const apiKey = process.env.API_KEY || '';

export const getMockAppraisal = (inventory: MineralItem[]): string => {
  const totalValue = inventory.reduce((sum, item) => sum + item.value, 0);
  const hasRare = inventory.some(i => 
    i.type === BlockType.DIAMOND || 
    i.type === BlockType.PAINITE || 
    i.type === BlockType.RUBY || 
    i.type === BlockType.EMERALD
  );
  const hasPristine = inventory.some(i => i.quality === QualityTier.PRISTINE);
  const onlyDirt = inventory.every(i => i.type === BlockType.DIRT || i.type === BlockType.STONE);

  if (inventory.length === 0) return "空的？你在浪费我的时间。";
  if (onlyDirt) return "一堆石头和泥巴... 甚至不够付清理费。";
  
  if (totalValue > 5000) {
     if (hasPristine) return "难以置信！这是传说中的完美宝石！我们发财了！";
     return "哇哦，满载而归！这可是大丰收啊。";
  }
  
  if (hasRare) return "哦？看来你找到了些好东西。这块宝石成色不错。";
  if (totalValue > 1000) return "不错的收获，继续保持。";
  
  return "马马虎虎。这只能勉强维持生计。";
};

export const getMineralAppraisal = async (inventory: MineralItem[], useApi: boolean): Promise<string> => {
  if (!useApi || !apiKey) {
    // Simulate delay for mock appraisal to feel like "processing"
    return new Promise(resolve => {
      setTimeout(() => resolve(getMockAppraisal(inventory)), 800);
    });
  }

  // Filter only valuable minerals
  const valuables = inventory.filter(item => 
    item.type !== BlockType.DIRT && 
    item.type !== BlockType.STONE && 
    item.type !== BlockType.HARD_STONE
  );

  if (valuables.length === 0) {
    return "只有尘土和石头。下次好运吧，矿工。";
  }

  // Summarize items
  // e.g., "3x 铁矿 (总重 4.5kg), 1x 钻石 (完美品质)"
  const summaryParts: string[] = [];
  
  const grouped = valuables.reduce((acc, item) => {
    const key = item.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, MineralItem[]>);

  Object.entries(grouped).forEach(([name, items]) => {
    const count = items.length;
    const specialItems = items.filter(i => i.quality === QualityTier.PRISTINE || i.quality === QualityTier.HIGH);
    let detail = "";
    if (specialItems.length > 0) {
       detail = `(包含 ${specialItems.length} 个高品质)`;
    }
    summaryParts.push(`${count}x ${name}${detail}`);
  });

  const mineralSummary = summaryParts.join(', ');

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `你是一个说话刻薄的矮人矿物鉴定师。一个矿工刚给你带来了这些货物: ${mineralSummary}。
      请用中文写一句简短的（最多2句话）评价。
      如果有高品质的宝石（钻石、红宝石等），请表现得惊讶。如果都是普通货色或煤炭，请表现得不屑。`,
      config: {
        maxOutputTokens: 60,
        temperature: 0.8,
      }
    });
    
    return response.text || getMockAppraisal(inventory);
  } catch (error) {
    console.error("Gemini Error:", error);
    return getMockAppraisal(inventory);
  }
};