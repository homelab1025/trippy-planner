package com.trippyplanner.routes.application;

import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.routes.domain.model.NewRoute;
import com.trippyplanner.routes.domain.model.Route;
import com.trippyplanner.routes.domain.model.RouteAccessDeniedException;
import com.trippyplanner.routes.domain.model.RouteNotFoundException;
import com.trippyplanner.routes.domain.model.RouteSummary;
import com.trippyplanner.routes.domain.model.RouteUpdate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class RouteService {

    private final RouteRepository routeRepository;
    private final TokenGenerator tokenGenerator;

    public RouteService(RouteRepository routeRepository, TokenGenerator tokenGenerator) {
        this.routeRepository = routeRepository;
        this.tokenGenerator = tokenGenerator;
    }

    public List<RouteSummary> list(long userId) {
        return routeRepository.findAllByUserId(userId);
    }

    public Route create(long userId, NewRoute route) {
        return routeRepository.save(userId, route);
    }

    public Route get(long userId, UUID routeId) {
        Route route = routeRepository.findById(routeId)
            .orElseThrow(() -> new RouteNotFoundException(routeId));
        assertOwnership(routeId, userId);
        return route;
    }

    public Route update(long userId, UUID routeId, RouteUpdate update) {
        assertOwnership(routeId, userId);
        return routeRepository.update(routeId, update)
            .orElseThrow(() -> new RouteNotFoundException(routeId));
    }

    public void delete(long userId, UUID routeId) {
        assertOwnership(routeId, userId);
        routeRepository.delete(routeId);
    }

    /**
     * Returns the route's existing share token if it is already shared, so repeated calls keep the same link.
     */
    public String share(long userId, UUID routeId) {
        assertOwnership(routeId, userId);
        return routeRepository.findShareToken(routeId)
            .orElseGet(() -> routeRepository.share(routeId, tokenGenerator.generate()));
    }

    public void unshare(long userId, UUID routeId) {
        assertOwnership(routeId, userId);
        routeRepository.unshare(routeId);
    }

    private void assertOwnership(UUID routeId, long userId) {
        long ownerId = routeRepository.findOwnerUserId(routeId)
            .orElseThrow(() -> new RouteNotFoundException(routeId));
        if (ownerId != userId) {
            throw new RouteAccessDeniedException(routeId, userId);
        }
    }
}
