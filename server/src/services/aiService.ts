import { GoogleGenerativeAI } from '@google/generative-ai';
import { ICareInfo } from '../models/Plant.js';

// Pre-compiled verified botanical knowledge base for instant zero-latency responses & offline fallback
const BOTANICAL_PRESETS: Record<string, ICareInfo> = {
  monstera: {
    shortDescription: 'Monstera deliciosa (Swiss Cheese Plant) is an iconic tropical climbing vine with dramatic perforated fenestrations.',
    idealTempMin: 18,
    idealTempMax: 28,
    criticalMinTemp: 10,
    criticalMaxTemp: 35,
    light: 'Bright indirect sunlight; tolerate medium light',
    humidity: 'High (60-80%), though adapts to moderate household humidity',
    soilType: 'Chunky, well-aerated aroid mix (bark, perlite, peat/coco coir)',
    wateringNeeds: 'Allow top 50% of potting mix to dry out before watering thoroughly.',
    waterMlPerPotLitre: 85,
    waterTypicalRange: '70 - 100 ml/L',
    recommendedFrequencyPerWeek: 1,
    droughtTolerance: 'medium',
    overwateringSensitivity: 'high',
    commonProblems: ['Yellowing leaves from overwatering', 'Brown crispy leaf edges from dry air', 'Spider mites in dry conditions'],
    tips: ['Wipe broad leaves with a damp cloth monthly', 'Provide a moss pole for aerial roots', 'Rotate pot quarterly for balanced foliage'],
  },
  'snake plant': {
    shortDescription: 'Sansevieria (Snake Plant / Mother-in-Law’s Tongue) is an extraordinarily hardy, architectural succulent that purifies indoor air.',
    idealTempMin: 16,
    idealTempMax: 30,
    criticalMinTemp: 8,
    criticalMaxTemp: 38,
    light: 'Low to bright indirect light, tolerates direct sun',
    humidity: 'Low to average (30-50%)',
    soilType: 'Cactus or succulent potting mix with coarse sand and perlite',
    wateringNeeds: 'Allow soil to dry out completely between waterings. When in doubt, wait another week.',
    waterMlPerPotLitre: 50,
    waterTypicalRange: '40 - 65 ml/L',
    recommendedFrequencyPerWeek: 0.5, // once every 2 weeks
    droughtTolerance: 'high',
    overwateringSensitivity: 'high',
    commonProblems: ['Mushy base or rotting rhizomes from soggy soil', 'Wrinkled foliage when severely dehydrated'],
    tips: ['Never allow water to pool in the center rosette', 'Use terracotta pots with drainage for fast drying'],
  },
  pothos: {
    shortDescription: 'Epipremnum aureum (Golden Pothos / Devil’s Ivy) is a versatile, fast-growing trailing vine celebrated for its forgiving nature.',
    idealTempMin: 18,
    idealTempMax: 29,
    criticalMinTemp: 10,
    criticalMaxTemp: 35,
    light: 'Low to bright indirect light; brighter light enhances leaf variegation',
    humidity: 'Moderate (40-60%)',
    soilType: 'Standard potting soil amended with perlite for aeration',
    wateringNeeds: 'Water when the top 2-3 inches of soil feel dry to the touch.',
    waterMlPerPotLitre: 75,
    waterTypicalRange: '60 - 90 ml/L',
    recommendedFrequencyPerWeek: 1,
    droughtTolerance: 'medium',
    overwateringSensitivity: 'medium',
    commonProblems: ['Drooping leaves when thirsty (bounces back quickly)', 'Pale yellow foliage from waterlogged roots'],
    tips: ['Trim leggy vines in spring to encourage bushy growth', 'Propagates effortlessly in water cuttings'],
  },
  'fiddle leaf fig': {
    shortDescription: 'Ficus lyrata (Fiddle Leaf Fig) is a stunning architectural tree known for large, violin-shaped glossy leaves.',
    idealTempMin: 18,
    idealTempMax: 26,
    criticalMinTemp: 12,
    criticalMaxTemp: 34,
    light: 'Lots of bright, filtered sunlight; morning gentle direct sun',
    humidity: 'Moderate to high (50-65%)',
    soilType: 'Rich, well-draining loamy potting soil with bark and perlite',
    wateringNeeds: 'Water thoroughly once the top 2 inches dry out, discarding drainage runoff.',
    waterMlPerPotLitre: 90,
    waterTypicalRange: '75 - 110 ml/L',
    recommendedFrequencyPerWeek: 1,
    droughtTolerance: 'low',
    overwateringSensitivity: 'high',
    commonProblems: ['Brown spots on interior leaves (edema/overwatering)', 'Dropping lower leaves from draft or relocation'],
    tips: ['Avoid moving once situated in a bright spot', 'Dust leaves regularly to maximize photosynthesis'],
  },
  'peace lily': {
    shortDescription: 'Spathiphyllum (Peace Lily) features glossy deep-green foliage and elegant white blooms, acting as a natural hydrometer.',
    idealTempMin: 18,
    idealTempMax: 27,
    criticalMinTemp: 12,
    criticalMaxTemp: 32,
    light: 'Low to medium indirect light; avoid harsh direct sun',
    humidity: 'High (50-70%)',
    soilType: 'Moisture-retentive potting mix with peat moss and perlite',
    wateringNeeds: 'Keep soil consistently slightly moist; will dramatically droop when thirsty.',
    waterMlPerPotLitre: 95,
    waterTypicalRange: '80 - 115 ml/L',
    recommendedFrequencyPerWeek: 1.5,
    droughtTolerance: 'low',
    overwateringSensitivity: 'medium',
    commonProblems: ['Severe drooping when dry', 'Brown leaf tips from tap water minerals or fluoride'],
    tips: ['Use filtered or dechlorinated water if leaf tips brown', 'Mist occasionally to elevate local humidity'],
  },
  'aloe vera': {
    shortDescription: 'Aloe barbadensis (Aloe Vera) is a soothing medicinal succulent with plump, gel-filled spiky leaves.',
    idealTempMin: 15,
    idealTempMax: 30,
    criticalMinTemp: 5,
    criticalMaxTemp: 38,
    light: 'Bright direct to indirect sunlight (6+ hours daily)',
    humidity: 'Low dry air (30-40%)',
    soilType: 'Gritty cactus/succulent mix with pumice or perlite',
    wateringNeeds: 'Water deeply but infrequently; soil must completely dry out between waterings.',
    waterMlPerPotLitre: 45,
    waterTypicalRange: '35 - 60 ml/L',
    recommendedFrequencyPerWeek: 0.5,
    droughtTolerance: 'high',
    overwateringSensitivity: 'high',
    commonProblems: ['Brown, mushy leaves from overwatering', 'Flat, pale leaves from inadequate sunlight'],
    tips: ['Plant in an unglazed terracotta pot with a large drainage hole', 'Withhold watering in winter months'],
  },
};

/**
 * Clean and normalize plant query key
 */
function normalizePlantName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

/**
 * Generate plant care info using Gemini API or intelligent preset fallback
 */
export async function generatePlantCareInfo(plantName: string): Promise<ICareInfo> {
  const normName = normalizePlantName(plantName);

  // Check preset first if exact match
  for (const [key, preset] of Object.entries(BOTANICAL_PRESETS)) {
    if (normName === key || normName.includes(key)) {
      return preset;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelsToTry = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
      let model = genAI.getGenerativeModel({ model: modelsToTry[0] });

      const prompt = `You are an expert master botanist. Provide comprehensive, accurate care guidelines for the plant "${plantName}".
Return ONLY a valid JSON object matching this exact schema without markdown wrap or code fences:
{
  "shortDescription": "string (1-2 sentences)",
  "idealTempMin": number (Celsius),
  "idealTempMax": number (Celsius),
  "criticalMinTemp": number (Celsius, minimum survivable),
  "criticalMaxTemp": number (Celsius, maximum tolerable),
  "light": "string",
  "humidity": "string",
  "soilType": "string",
  "wateringNeeds": "string (clear simple explanation)",
  "waterMlPerPotLitre": number (typical millilitres of water needed per 1 litre of pot volume per watering session, e.g. 50 to 120),
  "waterTypicalRange": "string (e.g. '60 - 90 ml/L')",
  "recommendedFrequencyPerWeek": number (e.g. 1, 1.5, 2, or 0.5),
  "droughtTolerance": "low" | "medium" | "high",
  "overwateringSensitivity": "low" | "medium" | "high",
  "commonProblems": ["string", "string", "string"],
  "tips": ["string", "string", "string"]
}`;

      let result: any = null;
      for (const modelName of modelsToTry) {
        try {
          model = genAI.getGenerativeModel({ model: modelName });
          result = await Promise.race([
            model.generateContent(prompt),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout')), 15000)),
          ]);
          if (result) break;
        } catch (mErr) {
          console.warn(`[AIService] Model ${modelName} failed (${(mErr as Error).message}), trying next...`);
        }
      }

      if (!result) throw new Error('All Gemini models failed');

      const text = result.response.text();
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate numeric ranges and sanitize
      return {
        shortDescription: parsed.shortDescription || `${plantName} is a popular houseplant.`,
        idealTempMin: Number(parsed.idealTempMin) || 18,
        idealTempMax: Number(parsed.idealTempMax) || 27,
        criticalMinTemp: Number(parsed.criticalMinTemp) || 10,
        criticalMaxTemp: Number(parsed.criticalMaxTemp) || 35,
        light: parsed.light || 'Bright indirect light',
        humidity: parsed.humidity || 'Moderate (40-60%)',
        soilType: parsed.soilType || 'Well-draining potting soil',
        wateringNeeds: parsed.wateringNeeds || 'Water when topsoil is dry to touch.',
        waterMlPerPotLitre: Math.max(30, Math.min(200, Number(parsed.waterMlPerPotLitre) || 80)),
        waterTypicalRange: parsed.waterTypicalRange || `${Math.max(30, Number(parsed.waterMlPerPotLitre) - 20 || 60)} - ${Math.min(200, Number(parsed.waterMlPerPotLitre) + 20 || 100)} ml/L`,
        recommendedFrequencyPerWeek: Math.max(0.2, Math.min(4, Number(parsed.recommendedFrequencyPerWeek) || 1)),
        droughtTolerance: ['low', 'medium', 'high'].includes(parsed.droughtTolerance) ? parsed.droughtTolerance : 'medium',
        overwateringSensitivity: ['low', 'medium', 'high'].includes(parsed.overwateringSensitivity) ? parsed.overwateringSensitivity : 'medium',
        commonProblems: Array.isArray(parsed.commonProblems) ? parsed.commonProblems.slice(0, 4) : ['Overwatering yellowing', 'Underwatering drooping'],
        tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 4) : ['Ensure pot has drainage', 'Check soil moisture before watering'],
      };
    } catch (err) {
      console.warn(`[AIService] Gemini request failed for "${plantName}": ${(err as Error).message}. Using smart generic botanical model.`);
    }
  }

  // Graceful fallback for any plant
  return {
    shortDescription: `${plantName} is a beloved plant that thrives with consistent care and attentive observation.`,
    idealTempMin: 18,
    idealTempMax: 26,
    criticalMinTemp: 10,
    criticalMaxTemp: 35,
    light: 'Bright indirect light; protect from harsh midday sun',
    humidity: 'Moderate humidity (45-60%)',
    soilType: 'Organic, aerated potting mix with perlite or pumice',
    wateringNeeds: 'Water thoroughly when the top 3-4 cm of potting substrate is dry.',
    waterMlPerPotLitre: 75,
    waterTypicalRange: '60 - 90 ml/L',
    recommendedFrequencyPerWeek: 1,
    droughtTolerance: 'medium',
    overwateringSensitivity: 'medium',
    commonProblems: ['Leaves wilting from moisture stress', 'Tip browning from dry indoor atmosphere', 'Pest attraction in stagnant air'],
    tips: ['Empty runoff saucer within 20 minutes of watering', 'Inspect undersides of leaves weekly', 'Wipe foliage gently to remove dust'],
  };
}

/**
 * Pot Material and Drainage Adjustment calculation
 * Terracotta dries faster -> 1.15
 * Ceramic holds water longer -> 0.95
 * Plastic -> 1.00
 * Drainage hole: yes = 1.00, no = 0.80 (must be watered cautiously to avoid rot)
 */
export function calculateBaseWaterMl(
  waterMlPerPotLitre: number,
  volumeL: number,
  material: 'plastic' | 'terracotta' | 'ceramic' = 'plastic',
  hasDrainage: boolean = true
): number {
  let materialFactor = 1.0;
  if (material === 'terracotta') materialFactor = 1.15;
  else if (material === 'ceramic') materialFactor = 0.95;

  const drainageFactor = hasDrainage ? 1.0 : 0.8;

  const rawMl = waterMlPerPotLitre * volumeL * materialFactor * drainageFactor;
  // Round to practical 10 ml increment
  return Math.max(10, Math.round(rawMl / 10) * 10);
}
