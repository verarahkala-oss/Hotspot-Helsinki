# API Security Documentation

## Overview

All API endpoints are now secured with multiple layers of protection to prevent abuse and protect API keys.

## Security Features Implemented

### 1. Rate Limiting

**Implementation**: Token bucket algorithm with per-IP tracking

**Limits**:
- `google-places.js`: 100 requests per 15 minutes per IP
- `events-lite.js`: 50 requests per 15 minutes per IP (lower due to heavier processing)

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-13T12:45:00.000Z
```

**Rate Limit Exceeded Response** (429):
```json
{
  "error": "Too many requests",
  "retryAfter": "2025-11-13T12:45:00.000Z"
}
```

### 2. CORS (Cross-Origin Resource Sharing)

**Allowed Origins**:
- `http://localhost:5173` (dev)
- `http://localhost:4173` (preview)
- `https://hotspot-helsinki.vercel.app` (production)
- `https://helsinki-hotspots.vercel.app` (production alternate)
- All Vercel preview deployments

**Behavior**:
- Requests from allowed origins receive `Access-Control-Allow-Origin` header
- Requests from unknown origins are rejected (no CORS headers)

### 3. Input Validation

All user inputs are validated and sanitized:

**Coordinates**:
- Latitude: -90 to 90
- Longitude: -180 to 180

**Strings**:
- Max length: 200 characters
- Null bytes removed
- Trimmed

**Numbers**:
- Range validation (e.g., radius 1-50km)
- NaN checks

**IDs & References**:
- Alphanumeric with hyphens/underscores only
- Length limits enforced

**Categories**:
- Whitelist: music, food, sports, family, arts, tech, nightlife, other

### 4. API Key Protection

**Best Practices**:
- ✅ Keys stored in environment variables
- ✅ Keys never exposed to client
- ✅ Server-side proxy pattern
- ✅ No API keys in responses or error messages

## Endpoint Security Details

### `/api/google-places.js`

**Actions**: `details`, `search`, `nearby`, `photo`

**Validation**:
- `placeId`: Alphanumeric, 1-200 chars
- `query`: String, max 200 chars
- `lat`/`lng`: Valid coordinates
- `radius`: 1-50000 meters
- `type`: String, max 50 chars
- `photoReference`: Alphanumeric, 1-500 chars
- `maxWidth`: 1-1600 pixels

**Rate Limit**: 100 req/15min per IP

### `/api/events-lite.js`

**Query Parameters**:
- `lat`/`lng`: Valid coordinates (default: Helsinki center)
- `radiusKm`: 1-50 km
- `limit`: 1-1000 events
- `q`: Search query, max 200 chars
- `category`: One of allowed categories
- `bbox`: Format `minLng,minLat,maxLng,maxLat`
- `freeOnly`: Boolean
- `liveOnly`: Boolean

**Rate Limit**: 50 req/15min per IP

## Error Handling

### Validation Errors (400)

```json
{
  "error": "Invalid latitude: 999"
}
```

### Rate Limit Errors (429)

```json
{
  "error": "Too many requests",
  "retryAfter": "2025-11-13T12:45:00.000Z"
}
```

### Server Errors (500)

```json
{
  "error": "Failed to fetch from Google Places API"
}
```

Note: Internal error details are NOT exposed to clients.

## Testing Rate Limits

### Test with curl:

```bash
# Google Places endpoint
for i in {1..101}; do
  curl "https://your-domain.vercel.app/api/google-places?action=details&placeId=test123"
done

# Events endpoint
for i in {1..51}; do
  curl "https://your-domain.vercel.app/api/events-lite?lat=60.1699&lng=24.9384"
done
```

The 101st/51st request should return a 429 error.

## Monitoring

### Check Rate Limit Headers

```bash
curl -I "https://your-domain.vercel.app/api/google-places?action=details&placeId=test"
```

Look for:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Environment Variables

Required for production:

```bash
# Google Places API
GOOGLE_PLACES_API_KEY=your_key_here

# Optional: Additional event sources
EVENTBRITE_API_KEY=your_key_here
MEETUP_API_KEY=your_key_here

# Vercel KV (for caching)
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
```

## Recommended Additional Security (Future)

1. **API Authentication**: Add bearer token for frontend-to-API auth
2. **Request Signing**: HMAC signatures to prevent replay attacks
3. **Geo-blocking**: Restrict to specific regions (Finland/Europe)
4. **WAF Rules**: Use Vercel's firewall for DDoS protection
5. **Monitoring**: Set up alerts for unusual traffic patterns

## Vercel Configuration

Add to `vercel.json` for additional protection:

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## Security Checklist

- [x] API keys in environment variables
- [x] Rate limiting per IP
- [x] CORS with allowed origins
- [x] Input validation & sanitization
- [x] Error messages don't leak sensitive info
- [x] Server-side proxy pattern
- [x] Request timeouts (10s)
- [ ] Add API authentication (optional)
- [ ] Set up monitoring/alerts (optional)
- [ ] Configure WAF rules (optional)

## Contact

For security issues, please report to: vera@example.com (replace with your email)
