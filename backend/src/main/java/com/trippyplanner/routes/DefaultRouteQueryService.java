package com.trippyplanner.routes;

import com.trippyplanner.model.Route;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
final class DefaultRouteQueryService implements RouteQueryService {

    private final RouteRepository routeRepository;

    DefaultRouteQueryService(RouteRepository routeRepository) {
        this.routeRepository = routeRepository;
    }

    @Override
    public Optional<Route> findByShareToken(String shareToken) {
        return routeRepository.findByShareToken(shareToken);
    }
}
