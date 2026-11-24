package com.trippyplanner.application;

import com.trippyplanner.domain.model.Route;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RouteRepository {

    List<Route> findAllByOwnerId(long ownerId);

    Optional<Route> findById(UUID id);

    Optional<Route> findByShareToken(String shareToken);

    Optional<String> findGpx(UUID id);

    /**
     * Returns the route as stored, so database-side normalisation (e.g. numeric rounding) is visible to callers.
     */
    Route insert(Route route, String gpxContent);

    /**
     * Overwrites the user-editable fields (last write wins). Sharing state and the immutable GPX are not written,
     * so a concurrent edit can't resurrect a revoked share token.
     */
    Optional<Route> update(Route route);

    Optional<Route> updateSharing(Route route);

    void delete(UUID id);
}
