package com.trippyplanner.routes;

import com.trippyplanner.api.RoutesApi;
import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.common.TokenGenerator;
import com.trippyplanner.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
public class RoutesController implements RoutesApi {

    private final RouteRepository routeRepository;
    private final TokenGenerator tokenGenerator;
    private final CurrentUser currentUser;

    public RoutesController(RouteRepository routeRepository, TokenGenerator tokenGenerator,
            CurrentUser currentUser) {
        this.routeRepository = routeRepository;
        this.tokenGenerator = tokenGenerator;
        this.currentUser = currentUser;
    }

    @Override
    public ResponseEntity<List<RouteListItem>> listRoutes() {
        return ResponseEntity.ok(routeRepository.findAllByUserId(currentUser.userId()));
    }

    @Override
    public ResponseEntity<Route> createRoute(CreateRouteRequest body) {
        Route route = routeRepository.save(currentUser.userId(), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(route);
    }

    @Override
    public ResponseEntity<Route> getRoute(UUID id) {
        Route route = routeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        assertOwnership(id, currentUser.userId());
        return ResponseEntity.ok(route);
    }

    @Override
    public ResponseEntity<Route> updateRoute(UUID id, UpdateRouteRequest body) {
        assertOwnership(id, currentUser.userId());
        Route updated = routeRepository.update(id, body)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(updated);
    }

    @Override
    public ResponseEntity<Void> deleteRoute(UUID id) {
        assertOwnership(id, currentUser.userId());
        routeRepository.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<ShareResponse> shareRoute(UUID id) {
        assertOwnership(id, currentUser.userId());
        String token = routeRepository.findShareToken(id)
            .orElseGet(() -> routeRepository.share(id, tokenGenerator.generate()));
        ShareResponse response = new ShareResponse();
        response.setShareToken(token);
        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<Void> unshareRoute(UUID id) {
        assertOwnership(id, currentUser.userId());
        routeRepository.unshare(id);
        return ResponseEntity.noContent().build();
    }

    private void assertOwnership(UUID routeId, long userId) {
        Long ownerId = routeRepository.findOwnerUserId(routeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!ownerId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }
}
