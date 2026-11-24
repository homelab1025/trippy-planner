package com.trippyplanner.adapter.web;

import com.trippyplanner.api.RoutesApi;
import com.trippyplanner.domain.model.CurrentUser;
import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.Route;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.ShareResponse;
import com.trippyplanner.model.UpdateRouteRequest;
import com.trippyplanner.application.RouteService;
import com.trippyplanner.domain.model.RouteAccessDeniedException;
import com.trippyplanner.domain.model.RouteNotFoundException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
public class RoutesController implements RoutesApi {

    private final RouteService routeService;

    public RoutesController(RouteService routeService) {
        this.routeService = routeService;
    }

    @Override
    public ResponseEntity<List<RouteListItem>> listRoutes(CurrentUser currentUser) {
        return ResponseEntity.ok(routeService.list(currentUser.userId()).stream()
            .map(RouteDtoMapper::toListItem)
            .toList());
    }

    @Override
    public ResponseEntity<Route> createRoute(CreateRouteRequest body, CurrentUser currentUser) {
        var route = routeService.create(currentUser.userId(), RouteDtoMapper.toCommand(body), body.getGpxContent());
        return ResponseEntity.status(HttpStatus.CREATED).body(RouteDtoMapper.toDto(route, body.getGpxContent()));
    }

    @Override
    public ResponseEntity<Route> getRoute(UUID id, CurrentUser currentUser) {
        var route = routeService.get(currentUser.userId(), id);
        return ResponseEntity.ok(RouteDtoMapper.toDto(route, routeService.getGpx(currentUser.userId(), id)));
    }

    @Override
    public ResponseEntity<Route> updateRoute(UUID id, UpdateRouteRequest body, CurrentUser currentUser) {
        var route = routeService.update(currentUser.userId(), id, RouteDtoMapper.toCommand(body));
        return ResponseEntity.ok(RouteDtoMapper.toDto(route, routeService.getGpx(currentUser.userId(), id)));
    }

    @Override
    public ResponseEntity<Void> deleteRoute(UUID id, CurrentUser currentUser) {
        routeService.delete(currentUser.userId(), id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<ShareResponse> shareRoute(UUID id, CurrentUser currentUser) {
        ShareResponse response = new ShareResponse();
        response.setShareToken(routeService.share(currentUser.userId(), id));
        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<Void> unshareRoute(UUID id, CurrentUser currentUser) {
        routeService.unshare(currentUser.userId(), id);
        return ResponseEntity.noContent().build();
    }

    // sendError (not a ResponseEntity) so Spring Boot renders its standard error body, as before the refactor
    @ExceptionHandler(RouteNotFoundException.class)
    void handleNotFound(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND);
    }

    @ExceptionHandler(RouteAccessDeniedException.class)
    void handleAccessDenied(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }
}
