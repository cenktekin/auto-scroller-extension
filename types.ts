
export interface ReaderSettings {
  scrollSpeed: number;
  lineThickness: number;
  lineColor: string;
  lineOpacity: number;
  isScrolling: boolean;
  scrollDirection: 'down' | 'up';
  focusLinePosition: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  scrollSpeed: 5,
  lineThickness: 3,
  lineColor: '#00ffff',
  lineOpacity: 80,
  isScrolling: false,
  scrollDirection: 'down',
  focusLinePosition: 50,
};

export interface ChromeMessage {
  type: 'TOGGLE_SCROLL' | 'UPDATE_SETTINGS' | 'GET_STATUS' | 'TOGGLE_READING_MODE';
  payload?: Partial<ReaderSettings>;
}