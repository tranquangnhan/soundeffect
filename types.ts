
export enum SoundSource {
  UPLOAD = 'UPLOAD',
  EXTRACTED = 'EXTRACTED',
  WEB_SEARCH = 'WEB_SEARCH'
}

export interface SoundEffect {
  id: string;
  name: string;
  category: string;
  tags: string[];
  url: string; // Blob URL (Local) or Drive WebContentLink
  driveId?: string; // ID on Google Drive
  duration: number; // in seconds
  source: SoundSource;
  isFavorite: boolean;
  createdAt: number;
  copyrightStatus?: 'Safe' | 'Risky' | 'Unknown';
  copyrightReason?: string;
}

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

export interface GoogleConfig {
  apiKey: string;
  clientId: string;
}

export type ViewMode = 'LIBRARY' | 'UPLOAD' | 'EXTRACTOR' | 'WEB_SEARCH' | 'RECOMMENDATIONS';

export const CATEGORIES = [
  'Chưa phân loại',
  'Điện ảnh',
  'Foley (Tiếng động)',
  'Giao diện/UI',
  'Môi trường',
  'Kinh dị',
  'Hài hước',
  'Hành động',
  'Khoa học viễn tưởng'
];