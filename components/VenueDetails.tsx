import { useState, useEffect } from 'react';
import {
  getCachedPlaceDetails,
  findNearbyPlaces,
  getPhotoUrl,
  getOpeningStatus,
  getTodayHours,
  formatRating,
  formatPriceLevel,
  type PlaceDetails,
  type NearbyPlace,
} from '../src/utils/googlePlaces';

interface VenueDetailsProps {
  venueName: string;
  lat: number;
  lng: number;
}

export function VenueDetails({ venueName, lat, lng }: VenueDetailsProps) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNearby, setShowNearby] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Fetch venue details
    getCachedPlaceDetails(venueName, lat, lng)
      .then((data: PlaceDetails | null) => {
        setDetails(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [venueName, lat, lng]);

  const loadNearby = async () => {
    if (nearby.length > 0) {
      setShowNearby(!showNearby);
      return;
    }
    
    setShowNearby(true);
    const places = await findNearbyPlaces(lat, lng, 500, 'restaurant');
    setNearby(places);
  };

  if (loading) {
    return <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>Loading venue details...</div>;
  }

  if (!details) {
    return null;
  }

  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      fontSize: '13px'
    }}>
      {/* Venue Photo */}
      {details.photos && details.photos[0] && (
        <img
          src={getPhotoUrl(details.photos[0].photo_reference, 300)}
          alt={details.name}
          style={{
            width: '100%',
            height: '150px',
            objectFit: 'cover',
            borderRadius: '6px',
            marginBottom: '10px'
          }}
        />
      )}

      {/* Rating */}
      {details.rating && (
        <div style={{ marginBottom: '6px', fontSize: '14px' }}>
          {formatRating(details.rating, details.user_ratings_total)}
          {details.price_level && (
            <span style={{ marginLeft: '8px', color: '#666' }}>
              {formatPriceLevel(details.price_level)}
            </span>
          )}
        </div>
      )}

      {/* Opening Hours */}
      {details.opening_hours && (
        <div style={{ marginBottom: '6px' }}>
          <strong style={{ fontSize: '12px' }}>
            {getOpeningStatus(details.opening_hours)}
          </strong>
          {details.opening_hours.weekday_text && (
            <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
              {getTodayHours(details.opening_hours)}
            </div>
          )}
        </div>
      )}

      {/* Address */}
      {details.formatted_address && (
        <div style={{ color: '#666', fontSize: '11px', marginBottom: '6px' }}>
          📍 {details.formatted_address}
        </div>
      )}

      {/* Phone */}
      {details.formatted_phone_number && (
        <div style={{ color: '#666', fontSize: '11px', marginBottom: '6px' }}>
          📞 {details.formatted_phone_number}
        </div>
      )}

      {/* Website */}
      {details.website && (
        <a
          href={details.website}
          target="_blank"
          rel="noreferrer"
          style={{
            color: '#007aff',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'inline-block',
            marginTop: '6px'
          }}
        >
          Visit Website →
        </a>
      )}

      {/* Nearby Places Toggle */}
      <button
        onClick={loadNearby}
        style={{
          marginTop: '10px',
          padding: '6px 12px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          width: '100%'
        }}
      >
        {showNearby ? '▼' : '▶'} Nearby Restaurants & Cafes
      </button>

      {/* Nearby Places List */}
      {showNearby && (
        <div style={{ marginTop: '10px' }}>
          {nearby.length === 0 ? (
            <div style={{ color: '#999', fontSize: '11px', padding: '8px' }}>
              Loading nearby places...
            </div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {nearby.map((place) => (
                <div
                  key={place.placeId}
                  style={{
                    padding: '8px',
                    marginBottom: '6px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {place.photoReference && (
                      <img
                        src={getPhotoUrl(place.photoReference, 100)}
                        alt={place.name}
                        style={{
                          width: '60px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '2px' }}>
                        {place.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                        {place.vicinity}
                      </div>
                      {place.rating && (
                        <div style={{ fontSize: '11px' }}>
                          ⭐ {place.rating.toFixed(1)}
                          {place.priceLevel && (
                            <span style={{ marginLeft: '6px' }}>
                              {"€".repeat(place.priceLevel)}
                            </span>
                          )}
                          {place.openNow !== undefined && (
                            <span style={{ marginLeft: '6px' }}>
                              {place.openNow ? '🟢' : '🔴'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
