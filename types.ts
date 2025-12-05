
export enum SoundSource {
  UPLOAD = 'UPLOAD',
  EXTRACTED = 'EXTRACTED',
  WEB_SEARCH = 'WEB_SEARCH'
}

export interface SoundEffect {
  id: string;
  name: string;
  filename: string; // The physical filename in the folder
  category: string;
  tags: string[];
  url: string; // Blob URL for playback
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

export type ViewMode = 'LIBRARY' | 'UPLOAD' | 'EXTRACTOR' | 'WEB_SEARCH' | 'RECOMMENDATIONS';

export const DEFAULT_CATEGORIES = [
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
