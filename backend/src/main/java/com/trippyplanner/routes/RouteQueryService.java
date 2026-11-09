package com.trippyplanner.routes;

import com.trippyplanner.model.Route;

import java.util.Optional;

/**
 * Read-only view of routes for other modules. Route persistence stays private to the routes module.
 */
public interface RouteQueryService {

    Optional<Route> findByShareToken(String shareToken);
}
