package com.trippyplanner.routes.domain.model;

import java.time.OffsetDateTime;

/**
 * A partial update: a null component means "leave unchanged", which is why {@code avgSpeedKmh} is boxed.
 */
public record RouteUpdate(
        String name,
        Double avgSpeedKmh,
        OffsetDateTime startTime,
        String checkpointsJson) {
}
