package com.trippyplanner.routes.domain.model;

import java.time.OffsetDateTime;
import java.util.Objects;

public record NewRoute(
        String name,
        String gpxContent,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        String checkpointsJson) {

    public NewRoute {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(gpxContent, "gpxContent");
    }
}
