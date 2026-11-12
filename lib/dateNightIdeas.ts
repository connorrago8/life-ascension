/** Thirty date-night ideas from Content & Design Pack v2, section 4. */

export type DateCost = '$' | '$$' | '$$$';
export type DateDuration = 'short' | 'evening' | 'full_day';
export type DateSetting = 'home' | 'out';

export type DateNightIdea = {
  id: number;
  title: string;
  blurb: string;
  cost: DateCost;
  duration: DateDuration;
  setting: DateSetting;
};

export const DATE_DURATION_LABEL: Record<DateDuration, string> = {
  short: 'Short',
  evening: 'Evening',
  full_day: 'Full day',
};

export const DATE_SETTING_LABEL: Record<DateSetting, string> = {
  home: 'Home',
  out: 'Out',
};

export const DATE_NIGHT_IDEAS: readonly DateNightIdea[] = [
  { id: 1, title: 'Cook a new recipe together', cost: '$', duration: 'evening', setting: 'home', blurb: 'Pick a dish neither of you has made and turn dinner into a shared experiment.' },
  { id: 2, title: 'No-phone walk', cost: '$', duration: 'short', setting: 'out', blurb: 'Leave the scrolling behind and follow whichever street looks interesting.' },
  { id: 3, title: 'Candlelit takeout', cost: '$$', duration: 'evening', setting: 'home', blurb: 'Dress up your favorite delivery like a reservation for two.' },
  { id: 4, title: 'Board-game duel', cost: '$', duration: 'evening', setting: 'home', blurb: 'Choose a game, invent a prize, and let friendly rivalry take over.' },
  { id: 5, title: 'Sunset lookout', cost: '$', duration: 'short', setting: 'out', blurb: 'Find a view and stay until the city lights come on.' },
  { id: 6, title: 'Coffee-shop crawl', cost: '$$', duration: 'short', setting: 'out', blurb: 'Split two drinks at two cafés and pick your favorite.' },
  { id: 7, title: 'Build a shared playlist', cost: '$', duration: 'short', setting: 'home', blurb: 'Trade songs and tell the stories attached to them.' },
  { id: 8, title: 'Museum afternoon', cost: '$$', duration: 'full_day', setting: 'out', blurb: 'Choose exhibits for each other and compare what caught your eye.' },
  { id: 9, title: 'Make homemade pizza', cost: '$', duration: 'evening', setting: 'home', blurb: 'Each design half a pizza, then trade slices.' },
  { id: 10, title: 'Thrift-store challenge', cost: '$', duration: 'short', setting: 'out', blurb: 'Find each other the funniest useful item under a small budget.' },
  { id: 11, title: 'Backyard or living-room picnic', cost: '$', duration: 'evening', setting: 'home', blurb: 'Lay out a blanket, snacks, and a little change of scenery.' },
  { id: 12, title: 'Pottery or art class', cost: '$$$', duration: 'evening', setting: 'out', blurb: 'Make imperfect keepsakes you\'ll remember longer than the lesson.' },
  { id: 13, title: 'Photo scavenger hunt', cost: '$', duration: 'short', setting: 'out', blurb: 'Find five textures, colors, or moments worth photographing together.' },
  { id: 14, title: 'Recreate your first date', cost: '$$', duration: 'evening', setting: 'out', blurb: 'Return to the details that started your story.' },
  { id: 15, title: 'Stargazing drive', cost: '$', duration: 'evening', setting: 'out', blurb: 'Find darker skies, bring blankets, and name your own constellations.' },
  { id: 16, title: 'Bookstore exchange', cost: '$', duration: 'short', setting: 'out', blurb: 'Choose a book for each other and explain why.' },
  { id: 17, title: 'At-home spa evening', cost: '$', duration: 'evening', setting: 'home', blurb: 'Put on music, slow down, and make rest the plan.' },
  { id: 18, title: 'Live jazz or small concert', cost: '$$$', duration: 'evening', setting: 'out', blurb: 'Let someone else\'s music set the pace for the night.' },
  { id: 19, title: 'Neighborhood food tour', cost: '$$', duration: 'evening', setting: 'out', blurb: 'Share one small dish at each of three stops.' },
  { id: 20, title: 'Mini-golf rivalry', cost: '$$', duration: 'short', setting: 'out', blurb: 'Compete for bragging rights, not a serious scorecard.' },
  { id: 21, title: 'Bake something ambitious', cost: '$', duration: 'evening', setting: 'home', blurb: 'Attempt a dessert that\'s slightly beyond your usual comfort zone.' },
  { id: 22, title: 'Day trip to a nearby town', cost: '$$', duration: 'full_day', setting: 'out', blurb: 'Pick a destination and discover it one block at a time.' },
  { id: 23, title: 'Rooftop dinner', cost: '$$$', duration: 'evening', setting: 'out', blurb: 'Make an ordinary evening feel like an occasion.' },
  { id: 24, title: 'Build a memory box', cost: '$', duration: 'evening', setting: 'home', blurb: 'Gather tickets, notes, and photos from the moments you want to keep.' },
  { id: 25, title: 'Farmers-market morning', cost: '$', duration: 'short', setting: 'out', blurb: 'Choose one ingredient and invent a meal around it.' },
  { id: 26, title: 'Arcade night', cost: '$$', duration: 'evening', setting: 'out', blurb: 'Trade tokens, challenge each other, and laugh at the high scores.' },
  { id: 27, title: 'Movie marathon with a theme', cost: '$', duration: 'evening', setting: 'home', blurb: 'Pick a genre, make matching snacks, and settle in.' },
  { id: 28, title: 'Botanical garden wander', cost: '$$', duration: 'full_day', setting: 'out', blurb: 'Spend a slow day somewhere green and unfamiliar.' },
  { id: 29, title: 'Hotel staycation', cost: '$$$', duration: 'full_day', setting: 'out', blurb: 'Explore your own city as though you\'ve just arrived.' },
  { id: 30, title: 'Plan a dream trip', cost: '$', duration: 'evening', setting: 'home', blurb: 'Build a fantasy itinerary, then choose one affordable piece to make real.' },
];
