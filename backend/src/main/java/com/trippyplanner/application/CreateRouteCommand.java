package com.trippyplanner.application;

import java.time.OffsetDateTime;

/**
 * The caller-supplied fields of a new route. Identity, owner, creation time and sharing state are deliberately
 * absent: {@link RouteService#create} assigns them.
 */
public record CreateRouteCommand(
        String name,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        String checkpointsJson) {
}
