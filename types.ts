export interface Manga {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  creatorId: string;
  creatorName: string;
  createdAt: any;
  views: number;
  likes: number;
  genres: string[];
  otherNames: string;
  updatedAt?: any;
  lastChapterNumber?: number;
}

export interface Chapter {
  id: string;
  title: string;
  number: number;
  images: string[];
  createdAt: any;
  mangaId: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: any;
}

export interface UserLibrary {
  readLater: string[]; // manga IDs
  readingNow: string[];
  favorites: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  library?: UserLibrary;
  downloadCount: number;
  usdtBalance: number;
}

export type LibraryCategory = 'readLater' | 'readingNow' | 'favorites';
