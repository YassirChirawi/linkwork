import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface BotActionRecord {
  id: string;
  timestamp: string; // ISO 8601
  module: 'easy_apply' | 'networking' | 'outreach' | 'auth' | 'hellowork' | 'simulation';
  actionType: 'APPLICATION_SENT' | 'APPLICATION_SKIPPED' | 'INVITATION_SENT' | 'POST_LIKED' | 'POST_COMMENTED' | 'SESSION_SAVED' | 'SIMULATION_SESSION_COMPLETED';
  target: string; // Titre du poste ou Nom de la personne
  company?: string;
  details?: string; // Note ou message envoyé
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'PENDING';
}

/**
 * Gestionnaire d'historique persistant des actions du bot.
 * Sauvegarde les actions dans un fichier JSON structuré et émet des événements en direct.
 */
export class HistoryManager extends EventEmitter {
  private static instance: HistoryManager;
  private filePath: string;
  private actions: BotActionRecord[] = [];

  private constructor() {
    super();
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'history.json');
    this.loadHistory();
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.actions = JSON.parse(raw);
      } else {
        this.actions = [];
        this.saveHistory();
      }
    } catch {
      this.actions = [];
    }
  }

  private saveHistory(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.actions, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de history.json:', err);
    }
  }

  /**
   * Enregistre une action effectuée par le bot
   */
  public logAction(record: Omit<BotActionRecord, 'id' | 'timestamp'>): BotActionRecord {
    const fullRecord: BotActionRecord = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...record,
    };

    // Ajoute en tête de liste (plus récent d'abord)
    this.actions.unshift(fullRecord);

    // Limiter la taille maximale d'historique à 1000 entrées
    if (this.actions.length > 1000) {
      this.actions = this.actions.slice(0, 1000);
    }

    this.saveHistory();
    this.emit('action_logged', fullRecord);
    return fullRecord;
  }

  /**
   * Récupère la liste de toutes les actions
   */
  public getHistory(limit = 100): BotActionRecord[] {
    return this.actions.slice(0, limit);
  }

  /**
   * Réinitialise l'historique
   */
  public clearHistory(): void {
    this.actions = [];
    this.saveHistory();
    this.emit('history_cleared');
  }
}

export const historyManager = HistoryManager.getInstance();
