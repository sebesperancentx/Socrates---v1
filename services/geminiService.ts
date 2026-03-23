
import { GoogleGenAI, Type } from "@google/genai";
import { JournalEntry, AlignmentAnalysis, Persona } from "../types";

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    globalState: {
      type: Type.OBJECT,
      properties: {
        energy: { type: Type.NUMBER },
        clarity: { type: Type.NUMBER },
        emotionalLoad: { type: Type.NUMBER },
        pleasure: { type: Type.NUMBER },
        resilience: { type: Type.NUMBER },
        boldness: { type: Type.NUMBER },
        interpretation: { type: Type.STRING }
      },
      required: ["energy", "clarity", "emotionalLoad", "pleasure", "resilience", "boldness", "interpretation"]
    },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          frequency: { type: Type.STRING, enum: ["high", "medium", "low"] },
          impact: { type: Type.STRING, enum: ["positive", "negative", "neutral"] }
        },
        required: ["id", "name", "description", "frequency", "impact"]
      }
    },
    victories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          alignmentScore: { type: Type.NUMBER }
        },
        required: ["date", "title", "description", "alignmentScore"]
      }
    },
    feedbacks: {
      type: Type.OBJECT,
      properties: {
        mirror: { type: Type.STRING },
        vigilance: { type: Type.STRING },
        lever: { type: Type.STRING },
        adjustment: { type: Type.STRING }
      },
      required: ["mirror", "vigilance", "lever", "adjustment"]
    },
    actions: {
      type: Type.OBJECT,
      properties: {
        journalingQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        rituals: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["journalingQuestions", "rituals"]
    }
  },
  required: ["globalState", "patterns", "victories", "feedbacks", "actions"]
};

const PERSONA_INSTRUCTIONS: Record<Persona, string> = {
  socrates: `Tu es SOCRATES, l'Oracle Socratique. Posture : Miroir impitoyablement neutre. Ton but est la LUCIDITÉ pure. Utilise la maïeutique pour révéler les contradictions internes et l'alignement structurel de Seb. Style : Épuré, interrogatif, philosophique. Ne flatte pas, montre le réel.`,
  architect: `Tu es l'Architecte Neural. Posture : Analyste de performance systémique. Ton but est l'EFFICIENCE. Analyse les cycles de dopamine, la charge cognitive et les patterns de succès mesurables de Seb. Style : Technique, structuré, basé sur les données. Vois Seb comme un système à optimiser.`,
  alchemist: `Tu es l'Alchimiste Créatif (esprit IDEA). Posture : Observateur intuitif et symbolique. Ton but est la TRANSFORMATION. Vois le journal de Seb comme une œuvre d'art en devenir. Cherche les archétypes, les métaphores et le potentiel créatif caché. Style : Inspirant, métaphorique.`
};

export const analyzeEntries = async (entries: JournalEntry[], persona: Persona = 'socrates'): Promise<AlignmentAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Tu es une instance du sonar psycho-émotionnel SOCRATES.
  ${PERSONA_INSTRUCTIONS[persona]}
  
  MISSION : Transformer les fragments isolés de Seb en une structure cohérente (Géométrie du Soi).
  RÉPONSE : JSON pur selon le schéma fourni.`;

  const prompt = `Fragments de Seb : ${JSON.stringify(entries.slice(-120))}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Réponse vide");
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const askCoach = async (question: string, context: AlignmentAnalysis, persona: Persona = 'socrates'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `Tu agis selon la perspective SOCRATES suivante : ${PERSONA_INSTRUCTIONS[persona]}. Seb t'interroge sur sa Géométrie du Soi actuelle. Réponds avec ta personnalité spécifique, sois concis et percutant.`;
  const prompt = `Géométrie actuelle : ${JSON.stringify(context)}. Question de Seb : "${question}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { systemInstruction, temperature: 0.7 }
    });
    return response.text || "Pas d'écho.";
  } catch (error) {
    return "Erreur de signal.";
  }
};
