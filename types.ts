
export type Persona = 'socrates' | 'architect' | 'alchemist';

export interface ThemeAnalysis {
  name: string;
  sentiment: 'positive' | 'negative';
  relevance: number; 
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: 'high' | 'medium' | 'low';
  impact: 'positive' | 'negative' | 'neutral';
}

export interface Victory {
  date: string;
  title: string;
  description: string;
  alignmentScore: number;
}

export interface JournalEntry {
  date: string;
  text: string;
  emotions: string[];
  tags: string[];
}

export interface AlignmentAnalysis {
  globalState: {
    energy: number;
    clarity: number;
    emotionalLoad: number;
    pleasure: number;
    resilience: number;
    boldness: number;
    interpretation: string;
  };
  patterns: Pattern[];
  victories: Victory[];
  feedbacks: {
    mirror: string;
    vigilance: string;
    lever: string;
    adjustment: string;
  };
  actions: {
    journalingQuestions: string[];
    rituals: string[];
  };
}
