# Bounteer Changelog

## [0.8.0] - 2025-12-04
### Changed
- Updated candidate profile schema: migrated from `client_id` (string) to `source_item_id` (integer)
- Optimized schema loading script to extract only schemas instead of full OpenAPI specification
- Reduced schema.json file size by excluding paths, parameters, and other OpenAPI components

### Technical Improvements
- Modified `scripts/load_schema.py` to filter components.schemas only
- Updated documentation in comment.md to reflect new field structure
- Schema file now focused purely on data models for better context search

## [0.7.0] - 2025-12-01
### Added
- WebSocket subscription for candidate profile AI enrichment (real-time field auto-filling)
- Back navigation button on both Job Description and Candidate Profile Enrichment cards
- Candidate profile enrichment session polling for AI integration setup
- Smart state reset functionality when returning to setup (preserves call URL)

### Enhanced
- Orbit call dashboard now supports candidate profile enrichment session management
- Improved state management with proper cleanup when navigating back to setup
- Enhanced candidate call flow with WebSocket real-time updates matching job description pattern

### Technical Improvements
- Added proper session polling for candidate profile enrichment (similar to job description)
- Implemented custom stage change handlers for proper state reset
- Enhanced OrbitCallDashboard with separate polling logic for company vs candidate calls
- Improved error handling and connection management for candidate profile WebSocket subscriptions

## [0.6.0] - 2025-12-01
### Added
- Previous Orbit Call history list on dashboard when not-linked
- Company call selection and loading functionality to manual enrichment mode
- WebSocket heartbeat implementation (30-second intervals) to prevent disconnections
- Debug information section showing request ID and status in Potential Candidates card
- Enhanced candidate search polling with proper state management

### Modified
- Fixed AI enrichment toggle state synchronization when loading previous calls
- Improved candidate list layout to maintain left/right structure even with no candidates
- Fixed search candidate request state reset for multiple searches
- Enhanced candidate search result fetching with better error handling
- Updated color scheme from blue to primary coral colors throughout components
- Removed debug button in favor of integrated debug section
- Simplified PreviousOrbitCalls display (removed updated timestamp)

### Fixed
- WebSocket heartbeat preventing periodic disconnections in JobDescriptionEnrichment and CandidateProfileEnrichment
- GlowCard JSX attribute error (removed invalid jsx attribute)
- Polling interval interruption during candidate search status checks
- AI enrichment toggle not reflecting correct state when loading previous sessions
- Multiple search requests causing stuck "Searching..." state

## [0.4.2] - 2025-10-18
### Modified
- chnaged rfi flow so that it catches all the websocket messages

## [0.4.1] - 2025-10-16
### Added
- more dynamic rainbow effect
- RFI accept linkedin URL

## [0.4.0] - 2025-10-04
### Added
- Rainbow Effect

## [0.3.0] - 2025-10-04
### Added
- Role Fit Studio
### Modified
- changed the flow of role fit index to upload job description before new submission

## [0.2.1] - 2025-10-02
### Modified
- select last CV
- use of OSS 20B
- editable cover letter

## [0.2.0] - 2025-09-25
### Modified
- landing page fix
- ### Added
- cover letter generation
- expression card

## [0.1.5] - 2025-09-20
### Added
- talent pool options

## [0.1.4] - 2025-09-18
### Added
- printable report
- shield to prevent others looking at your report

## [0.1.3] - 2025-09-18
### Modified
- legal

## [0.1.2] - 2025-09-18
### Modified
- no more ismail image
- fix report table UI

## [0.1.1] - 2025-09-17
### Added
- report link to CV nad JD
- JD page
- marketplace coming soon page
### Removed
- career page
### Modified
- sidebar nested design

## [0.1.0] - 2025-09-17
### Added
- changelog, unit test
### Modified
- fixed the subscription auth
