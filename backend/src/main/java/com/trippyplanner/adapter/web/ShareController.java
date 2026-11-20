package com.trippyplanner.adapter.web;

import com.trippyplanner.api.ShareApi;
import com.trippyplanner.application.RouteService;
import com.trippyplanner.model.Route;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ShareController implements ShareApi {

    private final RouteService routeService;

    public ShareController(RouteService routeService) {
        this.routeService = routeService;
    }

    @Override
    public ResponseEntity<Route> getSharedRoute(String shareToken) {
        return routeService.findByShareToken(shareToken)
            .map(route -> ResponseEntity.ok(RouteDtoMapper.toSharedDto(route)))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
