import { LinkedEvent } from './fetchEvents';

interface EventbriteEvent {
  id: string;
  name: {
    text: string;
  };
  start: {
    local: string;
    timezone: string;
  };
  end: {
    local: string;
    timezone: string;
  };
  venue?: {
    latitude?: string;
    longitude?: string;
    address?: {
      city?: string;
      country?: string;
    };
  };
  url: string;
  is_free: boolean;
  category?: {
    name: string;
  };
}

interface EventbriteResponse {
  events: EventbriteEvent[];
  pagination: {
    page_count: number;
    page_number: number;
  };
}

/**
 * Fetch events from Eventbrite API for Helsinki area
 */
export async function fetchEventbriteEvents(): Promise<LinkedEvent[]> {
  const apiKey = import.meta.env.VITE_EVENTBRITE_API_KEY;
  
  if (!apiKey) {
    console.warn('Eventbrite API key not found. Skipping Eventbrite events.');
    return [];
  }

  try {
    // Get current date in ISO format
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    
    // Calculate end date (30 days from now to get upcoming events)
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Eventbrite API endpoint for searching events
    // Location: Helsinki, Finland (latitude: 60.1699, longitude: 24.9384)
    const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
    url.searchParams.append('location.latitude', '60.1699');
    url.searchParams.append('location.longitude', '24.9384');
    url.searchParams.append('location.within', '25km'); // 25km radius around Helsinki
    url.searchParams.append('start_date.range_start', `${startDate}T00:00:00`);
    url.searchParams.append('start_date.range_end', `${endDate}T23:59:59`);
    url.searchParams.append('expand', 'venue,category');
    url.searchParams.append('page_size', '100');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Eventbrite API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: EventbriteResponse = await response.json();
    const currentTime = Date.now();

    // Transform Eventbrite events to LinkedEvent format
    const events: LinkedEvent[] = data.events
      .filter((event) => {
        // Filter out events without location data
        if (!event.venue?.latitude || !event.venue?.longitude) {
          return false;
        }
        
        // Filter out past events
        if (event.end?.local) {
          const endTime = new Date(event.end.local).getTime();
          if (endTime < currentTime) {
            return false;
          }
        }
        
        return true;
      })
      .map((event) => {
        const startTime = new Date(event.start.local);
        const endTime = event.end?.local ? new Date(event.end.local) : null;

        // Format time display as duration (HH:MM - HH:MM) in Helsinki timezone
        let timeDisplay = '';
        if (startTime && endTime) {
          const startStr = startTime.toLocaleString('fi-FI', {
            timeZone: 'Europe/Helsinki',
            hour: '2-digit',
            minute: '2-digit',
          });
          const endStr = endTime.toLocaleString('fi-FI', {
            timeZone: 'Europe/Helsinki',
            hour: '2-digit',
            minute: '2-digit',
          });
          timeDisplay = `${startStr} - ${endStr}`;
        }

        return {
          id: `eventbrite-${event.id}`,
          title: event.name.text,
          start: event.start.local,
          end: event.end?.local,
          lat: parseFloat(event.venue!.latitude!),
          lng: parseFloat(event.venue!.longitude!),
          category: event.category?.name || 'Event',
          website: event.url,
          price: event.is_free ? 'free' : 'paid',
          time: timeDisplay,
        };
      });

    console.log(`Fetched ${events.length} events from Eventbrite API`);
    return events;
  } catch (error) {
    console.error('Error fetching Eventbrite events:', error);
    return [];
  }
}
