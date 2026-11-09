package com.trippyplanner.routes.domain.model;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

public record RouteSummary(
        UUID id,
        String name,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        boolean isPublic,
        OffsetDateTime createdAt) {

    public RouteSummary {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
    }
}
