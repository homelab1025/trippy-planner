package com.trippyplanner.routes.domain.model;

import java.util.UUID;

/**
 * A dedicated type rather than {@link java.util.NoSuchElementException}, so that the web adapter's 404 mapping
 * can't swallow unrelated {@code Optional.orElseThrow()} failures.
 */
public final class RouteNotFoundException extends RuntimeException {

    public RouteNotFoundException(UUID routeId) {
        super("Route " + routeId + " not found");
    }
}
