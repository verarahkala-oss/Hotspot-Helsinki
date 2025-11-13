/**
 * Personalization utilities for managing user preferences, liked events, and search history
 */

const LIKED_EVENTS_KEY = 'helsinki-hotspots-liked-events';
const CATEGORY_PREFS_KEY = 'helsinki-hotspots-category-prefs';
const RECENT_SEARCHES_KEY = 'helsinki-hotspots-recent-searches';
const MAX_RECENT_SEARCHES = 10;

export interface LikedEvent {
  id: string;
  title: string;
  category: string;
  likedAt: number;
}

export interface CategoryPreference {
  category: string;
  count: number; // Number of events liked in this category
  lastInteraction: number;
}

/**
 * Get all liked events
 */
export function getLikedEvents(): LikedEvent[] {
  try {
    const stored = localStorage.getItem(LIKED_EVENTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to load liked events:', error);
    return [];
  }
}

/**
 * Check if an event is liked
 */
export function isEventLiked(eventId: string): boolean {
  const liked = getLikedEvents();
  return liked.some(e => e.id === eventId);
}

/**
 * Like an event
 */
export function likeEvent(event: { id: string; title: string; category: string }): void {
  try {
    const liked = getLikedEvents();
    
    // Don't add duplicates
    if (liked.some(e => e.id === event.id)) {
      return;
    }
    
    const likedEvent: LikedEvent = {
      id: event.id,
      title: event.title,
      category: event.category,
      likedAt: Date.now()
    };
    
    liked.unshift(likedEvent); // Add to beginning
    localStorage.setItem(LIKED_EVENTS_KEY, JSON.stringify(liked));
    
    // Update category preferences
    updateCategoryPreference(event.category);
  } catch (error) {
    console.warn('Failed to like event:', error);
  }
}

/**
 * Unlike an event
 */
export function unlikeEvent(eventId: string): void {
  try {
    const liked = getLikedEvents();
    const filtered = liked.filter(e => e.id !== eventId);
    localStorage.setItem(LIKED_EVENTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn('Failed to unlike event:', error);
  }
}

/**
 * Toggle like status of an event
 */
export function toggleLikeEvent(event: { id: string; title: string; category: string }): boolean {
  const isLiked = isEventLiked(event.id);
  if (isLiked) {
    unlikeEvent(event.id);
    return false;
  } else {
    likeEvent(event);
    return true;
  }
}

/**
 * Get category preferences based on liked events
 */
export function getCategoryPreferences(): CategoryPreference[] {
  try {
    const stored = localStorage.getItem(CATEGORY_PREFS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to load category preferences:', error);
    return [];
  }
}

/**
 * Update category preference when an event is liked
 */
function updateCategoryPreference(category: string): void {
  try {
    const prefs = getCategoryPreferences();
    const existing = prefs.find(p => p.category === category);
    
    if (existing) {
      existing.count++;
      existing.lastInteraction = Date.now();
    } else {
      prefs.push({
        category,
        count: 1,
        lastInteraction: Date.now()
      });
    }
    
    // Sort by count (descending)
    prefs.sort((a, b) => b.count - a.count);
    
    localStorage.setItem(CATEGORY_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to update category preference:', error);
  }
}

/**
 * Get preferred categories sorted by user interest
 */
export function getPreferredCategories(): string[] {
  const prefs = getCategoryPreferences();
  return prefs.map(p => p.category);
}

/**
 * Get category preference score (for boosting in search results)
 */
export function getCategoryPreferenceScore(category: string): number {
  const prefs = getCategoryPreferences();
  const pref = prefs.find(p => p.category === category);
  
  if (!pref) return 0;
  
  // Higher count = higher score, max 500 points
  return Math.min(pref.count * 100, 500);
}

/**
 * Get recent searches
 */
export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to load recent searches:', error);
    return [];
  }
}

/**
 * Add a search to recent searches
 */
export function addRecentSearch(query: string): void {
  if (!query || query.trim().length < 2) return;
  
  try {
    const searches = getRecentSearches();
    const trimmed = query.trim();
    
    // Remove if already exists
    const filtered = searches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    
    // Add to beginning
    filtered.unshift(trimmed);
    
    // Keep only last MAX_RECENT_SEARCHES
    const limited = filtered.slice(0, MAX_RECENT_SEARCHES);
    
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn('Failed to save recent search:', error);
  }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    console.warn('Failed to clear recent searches:', error);
  }
}

/**
 * Get smart suggestions based on liked events
 */
export function getSmartSuggestions(): string[] {
  const liked = getLikedEvents();
  
  if (liked.length === 0) {
    return ['Try exploring different categories', 'Like events to get personalized suggestions'];
  }
  
  const prefs = getCategoryPreferences();
  const topCategories = prefs.slice(0, 3).map(p => p.category);
  
  const suggestions = [];
  
  if (topCategories.includes('music')) {
    suggestions.push('More music events near you');
  }
  if (topCategories.includes('food')) {
    suggestions.push('New restaurants and food experiences');
  }
  if (topCategories.includes('nightlife')) {
    suggestions.push('Tonight\'s hottest clubs and bars');
  }
  if (topCategories.includes('arts')) {
    suggestions.push('Art galleries and exhibitions');
  }
  if (topCategories.includes('sports')) {
    suggestions.push('Active outdoor events');
  }
  if (topCategories.includes('family')) {
    suggestions.push('Family-friendly activities');
  }
  
  // Generic suggestions if not enough specific ones
  if (suggestions.length === 0) {
    suggestions.push('Events similar to what you liked');
  }
  
  return suggestions;
}

/**
 * Clear all personalization data
 */
export function clearAllPersonalizationData(): void {
  try {
    localStorage.removeItem(LIKED_EVENTS_KEY);
    localStorage.removeItem(CATEGORY_PREFS_KEY);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    console.warn('Failed to clear personalization data:', error);
  }
}
