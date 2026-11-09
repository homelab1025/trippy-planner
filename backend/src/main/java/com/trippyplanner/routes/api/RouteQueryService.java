package com.trippyplanner.routes.api;

import java.util.Optional;

/**
 * Read-only view of routes for other modules. Route persistence stays private to the routes module.
 */
public interface RouteQueryService {

    Optional<SharedRoute> findByShareToken(String shareToken);
}
