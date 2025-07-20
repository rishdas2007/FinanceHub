import { db } from "../db";
import { narrativeMemory } from "@shared/schema";
import { eq, and, desc, gt } from "drizzle-orm";

interface NarrativeThread {
  themeGroup: string;
  narrativeThread: string;
  keyEvents: any[];
  themeStrength: number;
  lastMentioned: Date;
  themeStart: Date;
  isActive: boolean;
}

interface ThemeEvolution {
  previousTheme?: string;
  currentTheme: string;
  evolutionDirection: 'strengthening' | 'weakening' | 'new' | 'ending';
  continuityScore: number;
  narrativeConnection: string;
}

export class NarrativeMemoryService {
  
  async getActiveNarratives(): Promise<NarrativeThread[]> {
    try {
      const activeNarratives = await db
        .select()
        .from(narrativeMemory)
        .where(eq(narrativeMemory.isActive, true))
        .orderBy(desc(narrativeMemory.themeStrength));

      return activeNarratives.map(n => ({
        themeGroup: n.themeGroup,
        narrativeThread: n.narrativeThread,
        keyEvents: n.keyEvents as any[] || [],
        themeStrength: parseFloat(n.themeStrength),
        lastMentioned: n.lastMentioned,
        themeStart: n.themeStart,
        isActive: n.isActive || false
      }));
    } catch (error) {
      console.error('Error getting active narratives:', error);
      return [];
    }
  }

  async updateNarrative(themeGroup: string, newEvent: any, themeStrength: number): Promise<void> {
    try {
      const [existing] = await db
        .select()
        .from(narrativeMemory)
        .where(eq(narrativeMemory.themeGroup, themeGroup))
        .limit(1);

      if (existing) {
        // Update existing narrative
        const updatedEvents = [...(existing.keyEvents as any[] || []), newEvent];
        
        await db
          .update(narrativeMemory)
          .set({
            keyEvents: JSON.stringify(updatedEvents),
            themeStrength: themeStrength.toString(),
            lastMentioned: new Date(),
            isActive: themeStrength > 0.3 // Deactivate weak themes
          })
          .where(eq(narrativeMemory.id, existing.id));
      } else {
        // Create new narrative
        await db
          .insert(narrativeMemory)
          .values({
            themeGroup,
            narrativeThread: this.generateInitialNarrative(themeGroup, newEvent),
            keyEvents: JSON.stringify([newEvent]),
            themeStrength: themeStrength.toString(),
            lastMentioned: new Date(),
            themeStart: new Date(),
            isActive: true
          });
      }
    } catch (error) {
      console.error('Error updating narrative:', error);
    }
  }

  async analyzeThemeEvolution(currentTheme: string, marketData: any): Promise<ThemeEvolution> {
    try {
      const recentNarratives = await db
        .select()
        .from(narrativeMemory)
        .where(gt(narrativeMemory.lastMentioned, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
        .orderBy(desc(narrativeMemory.lastMentioned))
        .limit(3);

      const previousTheme = recentNarratives.length > 0 ? recentNarratives[0].themeGroup : undefined;
      const continuityScore = this.calculateContinuity(currentTheme, recentNarratives);
      
      let evolutionDirection: 'strengthening' | 'weakening' | 'new' | 'ending' = 'new';
      
      if (previousTheme === currentTheme) {
        evolutionDirection = continuityScore > 0.7 ? 'strengthening' : 'weakening';
      } else if (previousTheme && this.areThemesRelated(currentTheme, previousTheme)) {
        evolutionDirection = 'strengthening';
      }

      const narrativeConnection = this.createNarrativeConnection(
        currentTheme, 
        previousTheme, 
        evolutionDirection, 
        recentNarratives
      );

      return {
        previousTheme,
        currentTheme,
        evolutionDirection,
        continuityScore,
        narrativeConnection
      };
    } catch (error) {
      console.error('Error analyzing theme evolution:', error);
      return {
        currentTheme,
        evolutionDirection: 'new',
        continuityScore: 0,
        narrativeConnection: 'New market theme emerging'
      };
    }
  }

  async getThemeHistory(themeGroup: string, days: number = 30): Promise<any[]> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const history = await db
        .select()
        .from(narrativeMemory)
        .where(and(
          eq(narrativeMemory.themeGroup, themeGroup),
          gt(narrativeMemory.lastMentioned, cutoffDate)
        ))
        .orderBy(desc(narrativeMemory.lastMentioned));

      return history.map(h => ({
        date: h.lastMentioned,
        strength: parseFloat(h.themeStrength),
        events: h.keyEvents as any[] || []
      }));
    } catch (error) {
      console.error('Error getting theme history:', error);
      return [];
    }
  }

  private generateInitialNarrative(themeGroup: string, initialEvent: any): string {
    const narrativeTemplates = {
      'risk_on_off': 'Market sentiment shifts between risk appetite and defensive positioning',
      'inflation_cycle': 'Inflation dynamics shaping monetary policy and market expectations',
      'sector_rotation': 'Capital flows rotating between defensive and growth sectors',
      'volatility_regime': 'Market volatility patterns signaling regime changes',
      'fed_policy': 'Federal Reserve policy expectations driving market reactions',
      'earnings_cycle': 'Corporate earnings trends influencing sector performance',
      'geopolitical': 'Geopolitical developments affecting market risk sentiment'
    };

    return narrativeTemplates[themeGroup as keyof typeof narrativeTemplates] || 
           'Market theme developing with ongoing implications';
  }

  private calculateContinuity(currentTheme: string, recentNarratives: any[]): number {
    if (recentNarratives.length === 0) return 0;
    
    const sameThemeCount = recentNarratives.filter(n => n.themeGroup === currentTheme).length;
    return sameThemeCount / recentNarratives.length;
  }

  private areThemesRelated(theme1: string, theme2: string): boolean {
    const themeRelations = {
      'risk_on_off': ['sector_rotation', 'volatility_regime'],
      'inflation_cycle': ['fed_policy', 'sector_rotation'],
      'sector_rotation': ['risk_on_off', 'earnings_cycle'],
      'volatility_regime': ['risk_on_off', 'geopolitical'],
      'fed_policy': ['inflation_cycle', 'volatility_regime']
    };

    return themeRelations[theme1 as keyof typeof themeRelations]?.includes(theme2) || false;
  }

  private createNarrativeConnection(
    currentTheme: string, 
    previousTheme: string | undefined, 
    evolution: string,
    recentNarratives: any[]
  ): string {
    if (!previousTheme) {
      return `Emerging ${currentTheme.replace('_', ' ')} theme gaining traction`;
    }

    if (previousTheme === currentTheme) {
      if (evolution === 'strengthening') {
        return `${currentTheme.replace('_', ' ')} theme intensifying with additional supporting factors`;
      } else {
        return `${currentTheme.replace('_', ' ')} theme showing signs of exhaustion`;
      }
    }

    if (this.areThemesRelated(currentTheme, previousTheme)) {
      return `Market narrative evolving from ${previousTheme.replace('_', ' ')} to ${currentTheme.replace('_', ' ')}`;
    }

    return `Sharp theme shift from ${previousTheme.replace('_', ' ')} to ${currentTheme.replace('_', ' ')}`;
  }

  async cleanupOldNarratives(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Deactivate old narratives
      await db
        .update(narrativeMemory)
        .set({ isActive: false })
        .where(and(
          gt(narrativeMemory.lastMentioned, thirtyDaysAgo),
          eq(narrativeMemory.isActive, true)
        ));
    } catch (error) {
      console.error('Error cleaning up old narratives:', error);
    }
  }
}

export const narrativeMemoryService = new NarrativeMemoryService();