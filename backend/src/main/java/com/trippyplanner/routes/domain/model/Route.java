package com.trippyplanner.routes.domain.model;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A saved route with its GPX track. {@code checkpointsJson} is opaque to the backend and may be null.
 */
public record Route(
        UUID id,
        String name,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        boolean isPublic,
        OffsetDateTime createdAt,
        String gpxContent,
        String checkpointsJson) {

    public Route {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(gpxContent, "gpxContent");
    }
}
