package com.trippyplanner.routes.application;

import com.trippyplanner.routes.api.RouteQueryService;
import com.trippyplanner.routes.api.SharedRoute;
import com.trippyplanner.routes.domain.model.Route;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
final class DefaultRouteQueryService implements RouteQueryService {

    private final RouteRepository routeRepository;

    DefaultRouteQueryService(RouteRepository routeRepository) {
        this.routeRepository = routeRepository;
    }

    @Override
    public Optional<SharedRoute> findByShareToken(String shareToken) {
        return routeRepository.findByShareToken(shareToken).map(DefaultRouteQueryService::toSharedRoute);
    }

    private static SharedRoute toSharedRoute(Route route) {
        return new SharedRoute(route.id(), route.name(), route.avgSpeedKmh(), route.startTime(),
            route.createdAt(), route.gpxContent(), route.checkpointsJson());
    }
}
