
export interface ReaderSettings {
  scrollSpeed: number;
  lineThickness: number;
  lineColor: string;
  lineOpacity: number;
  isScrolling: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  scrollSpeed: 5,
  lineThickness: 3,
  lineColor: '#00ffff', // Neon Blue
  lineOpacity: 80,
  isScrolling: false,
};

export interface ChromeMessage {
  type: 'TOGGLE_SCROLL' | 'UPDATE_SETTINGS' | 'GET_STATUS';
  payload?: Partial<ReaderSettings>;
}