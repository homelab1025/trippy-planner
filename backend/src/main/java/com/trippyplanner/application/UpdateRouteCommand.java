package com.trippyplanner.application;

import java.time.OffsetDateTime;

/**
 * A partial update of a route's user-editable fields: a null component means "leave unchanged", which is why
 * {@code avgSpeedKmh} is boxed.
 */
public record UpdateRouteCommand(
        String name,
        Double avgSpeedKmh,
        OffsetDateTime startTime,
        String checkpointsJson) {
}
