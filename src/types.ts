/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MoodType = 'feliz' | 'cansado' | 'estresado' | 'triste' | 'neutro';

export interface DailyLog {
  id: string;
  date: string; // "YYYY-MM-DD"
  sleepHours: number;
  energyPercent: number;
  mood: MoodType;
  notes?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  detectedMood?: MoodType;
  showMbiScale?: boolean;
  mbiCode?: string;
  isSleepRegistration?: boolean;
}

export interface DoctorProfile {
  name: string;
  specialty: string;
  hospital: string;
  avatarSeed: string; // for consistent styling
}

