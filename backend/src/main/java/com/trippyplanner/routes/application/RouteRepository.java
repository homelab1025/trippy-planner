package com.trippyplanner.routes.application;

import com.trippyplanner.routes.domain.model.NewRoute;
import com.trippyplanner.routes.domain.model.Route;
import com.trippyplanner.routes.domain.model.RouteSummary;
import com.trippyplanner.routes.domain.model.RouteUpdate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RouteRepository {

    List<RouteSummary> findAllByUserId(long userId);

    Optional<Route> findById(UUID id);

    Optional<Long> findOwnerUserId(UUID id);

    Route save(long userId, NewRoute route);

    Optional<Route> update(UUID id, RouteUpdate update);

    void delete(UUID id);

    String share(UUID id, String token);

    void unshare(UUID id);

    Optional<Route> findByShareToken(String token);

    Optional<String> findShareToken(UUID id);
}
