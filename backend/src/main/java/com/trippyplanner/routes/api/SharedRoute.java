package com.trippyplanner.routes.api;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A publicly shared route as other modules see it. Deliberately separate from the routes domain model so the
 * domain can change without breaking consumers.
 */
public record SharedRoute(
        UUID id,
        String name,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        OffsetDateTime createdAt,
        String gpxContent,
        String checkpointsJson) {
}
