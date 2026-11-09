package com.trippyplanner.routes.domain.model;

import java.util.UUID;

public final class RouteAccessDeniedException extends RuntimeException {

    public RouteAccessDeniedException(UUID routeId, long userId) {
        super("User " + userId + " does not own route " + routeId);
    }
}
