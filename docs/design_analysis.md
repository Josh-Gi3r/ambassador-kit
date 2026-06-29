# Leaderboard Design Analysis — Reference Screenshots

## Common Design Elements Across All 5 References

### Top 3 Podium Section
- Top 3 winners displayed as a podium/hero section at the top
- #1 is center and slightly elevated/larger
- #2 is left, #3 is right
- Each has: circular avatar photo (real photo, not initials), name, score
- Rank badges: gold (#1), silver (#2), bronze (#3) circles overlaid on avatar
- Some refs show laurel wreaths, crown icons, or colored borders for top 3

### List Rows (rank 4+)
- Clean pill/card rows: rank number | circular avatar | name (+handle) | score | trend arrow
- Trend arrows: green ↑ for rising, red ↓ for falling
- Rows have subtle background, rounded corners
- Compact but readable — not a dense table

### Key Design Decisions
- Use your brand colors: white background, green (#00D395 or similar) accents
- Circular avatars with real X profile photos
- Evangelist badge: gold star/badge overlaid on avatar (like the colored borders in refs)
- Level badge (L1/L2) shown as a small pill under name
- Trend arrows (↑ rising, → stable, ↓ falling) from MASTER.md spec
- XP shown as "X XP" not "pts"
- Search bar at top
- Filter: show L1 + L2 only (per spec)

### What the current leaderboard is missing
1. No real profile photos (shows initials only)
2. No podium top-3 section
3. No trend arrows
4. No Evangelist gold badge visual
5. Rows are a dense table, not clean pill cards
6. Wrong filter (shows all, not L1+L2 only)

## Implementation Plan

### Phase 1: Fix X scraper to save profileImageUrl
- The Data API `Twitter/get_user_profile_by_username` returns profile data
- Need to extract `profileImageUrl` from the response and store in ambassador_applications.avatarUrl
- Run a backfill: for each ambassador with an xHandle, call the profile API and store the photo URL

### Phase 2: Rebuild leaderboard UI
Layout:
1. Header: "Leaderboard" title + search bar + filter (L1/L2 toggle)
2. Stats bar: total ambassadors, Evangelists count (X/12)
3. Podium section: top 3 with large circular avatars, rank badges, names, XP
4. List: rank 4+ as pill rows with avatar, name, handle, level badge, XP, trend arrow
5. Evangelist gold badge: small ⭐ or gold star overlaid on avatar corner

### Color palette (YourProtocol brand)
- Background: #FAFAFA (near white)
- Card/row background: #FFFFFF with border #E5E7EB
- Accent green: #00D395 (brand accent)
- Gold (Evangelist): #F59E0B
- Rising trend: #10B981 (green)
- Falling trend: #EF4444 (red)
- Stable trend: #6B7280 (gray)
- Rank #1 badge: #F59E0B (gold)
- Rank #2 badge: #9CA3AF (silver)
- Rank #3 badge: #D97706 (bronze)
